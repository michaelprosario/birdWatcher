const tf = require("@tensorflow/tfjs-node")
const amqp = require('amqplib');
const cocosSSd = require("@tensorflow-models/coco-ssd")
const { createCanvas, loadImage } = require('canvas');
const { createClient } = require('@supabase/supabase-js');
const { BlobServiceClient } = require("@azure/storage-blob");
const { v1: uuidv1 } = require("uuid");
var fs = require('fs');

const supabaseUrl = 'https://kpxlbckxgryibvhpenyk.supabase.co'
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtweGxiY2t4Z3J5aWJ2aHBlbnlrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTY5Mzc5NTY1MywiZXhwIjoyMDA5MzcxNjUzfQ.3CXBZEQ7tdjW4blqXmQ6Koesapg9VF8bdubyMvGqHEw";
const supabase = createClient(supabaseUrl, supabaseKey)


const AZURE_BLOB_STORAGE_CONNECTION_STRING = 
  process.env.AZURE_BLOB_STORAGE_CONNECTION_STRING;

if (!AZURE_BLOB_STORAGE_CONNECTION_STRING) 
{
  throw Error('Azure Storage Connection string not found');
}

const containerName = "picturesblobstorage";
const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_BLOB_STORAGE_CONNECTION_STRING);
const containerClient = blobServiceClient.getContainerClient(containerName);

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


async function deletePictureFromBlobStorage(fileName)
{  
  try 
  {
    const blobClient = containerClient.getBlobClient(fileName);
    console.log(`Delete blob ${fileName}`);
    await blobClient.delete(fileName);    

    return true;
  } catch (err) {
    console.error(err.message);
    return false;
  }  
}



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


// RabbitMQ connection URL
const rabbitmqUrl = 'amqp://localhost';

// Queue name to consume messages from
const queueName = 'review-picture-queue';

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


const objectDetection = new ObjectDetection();

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
