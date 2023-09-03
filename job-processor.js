const amqp = require('amqplib');

// RabbitMQ connection URL
const rabbitmqUrl = 'amqp://localhost';

// Queue name to consume messages from
const queueName = 'review-picture-queue';

// Create a function to process JSON messages
function processJsonMessage(message) {
  try {
    const json = JSON.parse(message.content.toString());
    // Replace this with your custom processing logic for the JSON data
    console.log('Received JSON:', json);
  } catch (error) {
    console.error('Error processing JSON message:', error.message);
  }
}

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
