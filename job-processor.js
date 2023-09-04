const tf = require("@tensorflow/tfjs-node")
const amqp = require('amqplib');
const cocosSSd = require("@tensorflow-models/coco-ssd")
const { createCanvas, loadImage } = require('canvas');

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

    const response = await objectDetection.predict(json.fileName);
    console.log(response)
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
