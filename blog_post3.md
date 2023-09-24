
In this series, we will continue building a small system to capture pictures of my back yard and detect if we see anything.  In the future, we want to search the database for birds. This post will focus on the problem of detecting objects in the image and storing them into a database. 

![Birds in nature](birds2.png)

TensorFlow.js is an open-source JavaScript library developed by Google's TensorFlow team. It enables machine learning and deep learning tasks to be performed directly in web browsers and Node.js environments using JavaScript or TypeScript. TensorFlow.js brings the power of TensorFlow, a popular machine learning framework, to the JavaScript ecosystem, making it accessible for web developers and data scientists.

Under the [TensorFlow Js Framework](https://www.tensorflow.org/js), you have access to the COCOS-SSD model that detects 80 classes of common objects.   The output response reports a list of objects found in the image, a confidence factor, bounding boxes to point to each object.  Check out this video for an example.

<iframe width="560" height="315" src="https://www.youtube.com/embed/tmtqS0Gc1k4?si=cT-GFKPO8rdQJ_Cf" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>

In the following code, we import some of our dependencies.  This includes
- TFJS - TensorflowJs
- cocosSSd - TensorFlow model for common object detection
- amqp - A library for connecting to rabbitMQ
- supabase/supabase-js - To log data of objects found, we will send our data to Supabase
- azure/storage-blob - To download pictures from Azure blob storage, we add a client library to connect to the cloud

``` javascript
const tf = require("@tensorflow/tfjs-node")
const amqp = require('amqplib');
const cocosSSd = require("@tensorflow-models/coco-ssd")
const { createCanvas, loadImage } = require('canvas');
const { createClient } = require('@supabase/supabase-js');
const { BlobServiceClient } = require("@azure/storage-blob");
const { v1: uuidv1 } = require("uuid");
var fs = require('fs');
```

My friend Javier got me excited about trying out [https://supabase.com/](Supabase).  If you're looking for a simple document or relational database solution with an easy api, it's pretty cool.  This code will grab some details from the environment and setup a supabase client.   

``` javascript
const supabaseUrl = process.env.SUPABASEURL;
const supabaseKey = process.env.SUPABASEKEY;
const supabase = createClient(supabaseUrl, supabaseKey)
```

To learn more about Supabase, check out [supabase.com](https://supabase.com/).

In our situation, the job-processor program and the watcher program will probably run on two different machines.  I will try to run the watcher process on a RaspberryPi.  The job processor will probably run on some other machine.   The watch program takes pictures and stores the files into Microsoft Azure blob storage.  The watcher signals the job processor by sending a message through rabbitMQ.   

Let's setup the connection to Azure Blob storage.

``` javascript
const AZURE_BLOB_STORAGE_CONNECTION_STRING = process.env.AZURE_BLOB_STORAGE_CONNECTION_STRING;

if (!AZURE_BLOB_STORAGE_CONNECTION_STRING) 
{
  throw Error('Azure Storage Connection string not found');
}

const containerName = "picturesblobstorage";
const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_BLOB_STORAGE_CONNECTION_STRING);
const containerClient = blobServiceClient.getContainerClient(containerName);
```

When we want to download a file from Azure blob storage, we leverage our container client.

``` javascript
async function downloadPictureFromBlobStorage(fileName)
{  
  try 
  {
    const blobClient = containerClient.getBlobClient(fileName);
    console.log(`Downloading blob ${fileName} to ${fileName}`);
    const downloadBlockBlobResponse = await blobClient.downloadToFile(fileName);
    console.log(`Downloaded ${downloadBlockBlobResponse.contentLength} bytes`);
    return true;
  } catch (err) {
    console.error(err.message);
    return false;
  }  
}
```

Let's setup our class for getting insight from our object detection algorithm.  In the following class, the "makeCanvasFromFilePath" method loads the picture into memory as a canvas.  Using CocosSSD mode, we detect objects in the image using the predict method. 

``` javascript
class ObjectDetection 
{
    constructor()
    {
        this.model = null;
    }

    async predict(image)
    {
        if(!this.model)
        {
            this.model = await cocosSSd.load();
        }

        const canvas = await this.makeCanvasFromFilePath(image);    
        const predictions = await this.model.detect(canvas);
        
        return { predictions: predictions }
    }

    async makeCanvasFromFilePath(image) {
        const img = await loadImage(image);
        const canvas = createCanvas(img.width, img.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        return canvas;
    }
}

const objectDetection = new ObjectDetection();

```

Let's configure RabbitMQ
``` javascript
// RabbitMQ connection URL
const rabbitmqUrl = 'amqp://localhost';

// Queue name to consume messages from
const queueName = 'review-picture-queue';
```

The "processJsonMessage" method is the heart of this nodeJs script.  At a high level, the system does the following tasks.
- Read a JSON message from the watcher program.
- Download the picture from Azure blob storage.
- Run object detection on the file.
- Store findings into database ( Supabase )

``` javascript 
// Create a function to process JSON messages
async function processJsonMessage(message) {
  try {
    const json = JSON.parse(message.content.toString());
    // Replace this with your custom processing logic for the JSON data
    console.log('Received JSON:', json);
    console.log(json.fileName);

    // need function to download file from blob storage 
    const fileDownloaded = await downloadPictureFromBlobStorage(json.fileName);
    if(fileDownloaded)
    {
      // Run TF prediction ...
      const response = await objectDetection.predict(json.fileName);
      console.log(response)
  
      // Store data in supabase ....
      const { error } = await supabase.from('watch_log').insert({ file_name: json.fileName, json: response })    
      if(error)
      {
        console.log("error object defined");
        console.log(error);
      }  

      deletePictureFromBlobStorage(json.fileName);
      fs.unlinkSync(json.fileName);

    }else{
      console.log("Error downloading file from blob storage");
    }

  } catch (error) {
    console.error('Error processing JSON message:', error.message);
  }
}
```

Here's some sample data captured as JSON:

```json
{
  "predictions": [
    {
      "bbox": [
        -0.36693572998046875,
        163.0312156677246,
        498.0821228027344,
        320.0614356994629
      ],
      "class": "person",
      "score": 0.6217759847640991
    }
  ]
}
```

In this last section, we connect ourselves to RabbitMQ so that we can start to accept work.

``` javascript

// Connect to RabbitMQ and consume messages
async function consume() {
  try {
    
    const connection = await amqp.connect(rabbitmqUrl);
    const channel = await connection.createChannel();
    
    await channel.assertQueue(queueName, { durable: false });
    
    console.log(`Waiting for messages in ${queueName}. To exit, press Ctrl+C`);
    
    channel.consume(queueName, (message) => {
      if (message !== null) {
        processJsonMessage(message);
        channel.ack(message);
      }
    });
  } catch (error) {
    console.error('Error:', error.message);
  }
}

consume();
```

