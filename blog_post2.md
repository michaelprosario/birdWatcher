

In this series, we will continue building a small system to capture pictures of my back yard and detect if we see birds.   In this post, we will focus on the problem of taking pictures every minute or so.   For fun, I decided to build this part in Python.  To review the system overview, check out my previous blog post here.

The solution for the watcher involves the following major elements and concepts.
- Setup a connection to Azure blob storage.   To keep things simple, [Azure blob storage](https://learn.microsoft.com/en-us/azure/storage/blobs/storage-quickstart-blobs-python?tabs=managed-identity,roles-azure-portal,sign-in-azure-cli) enables you to securely store files in Microsoft Azure cloud at low cost.   
- Set the time interval for taking pictures
- Setup connection to [message queue system](https://www.rabbitmq.com/tutorials/tutorial-one-python.html).   The watch program needs to send a message to an analysis program that will analyze the image content.  Please keep in mind that RabbitMQ is simply "email for computer programs." It's a way for programs to message each other to do work. I will be running the watcher program on a pretty low-complexity Raspberry PI 2. In my case, I wanted to off-load the image analysis to another computer system with a bit more horse power. In future work, we might move the analysis program to a cloud function. That's a topic for a future post.


Here's some pseudo code.
- Setup the program to take pictures
- Loop
	- Take a picture
	- Store the picture on disk
	- Upload the picture to Azure blob storage
	- Signal the analysis program to review the picture
	- Delete the local copy of the picture
	- Wait until we need to take a picture 

## Setting the stage

Let's start by sketching out the functions for setting up the blob storage, rabbit message queue, and camera.
At the top of the python file, we need to import the following: 
``` python
import  cv2
import  time
import  pika
import  json
import  os
from  azure.storage.blob  import  BlobServiceClient
```
In the following code, we setup the major players of the blob storage, rabbit message queue, and camera.
```
container_client  =  setup_blob_storage() 
# Set the time interval in seconds
interval  =  60  # every min 
# Initialize the webcam
cap  =  cv2.VideoCapture(0)  

# Check if the webcam is opened successfully

if  not  cap.isOpened():
	print("Error: Could not open the webcam.")
	exit()
queue_name, connection, channel  =  setup_rabbit_message_queue()
```
## Take a picture
In the later part of the program, we start to loop to take a picture and send the data to the analysis program.  
``` python
ret, frame  =  cap.read() 
if  not  ret:
	print("Error: Could not read frame from the webcam.")
	break  

timestamp, filename = store_picture_on_disk(frame)
print(f"Image captured and saved as {filename}")
```

## Send the picture to Blob Storage
``` python
local_file_path  =  filename
blob_name  =  filename 
with  open(local_file_path, "rb") as  data:
	container_client.upload_blob(name=blob_name, data=data)
```
## Signal analysis program to review image using a message
``` python
# Prepare a JSON message
message  = {
'fileName': filename,
'timestamp': timestamp,
}
message_json  =  json.dumps(message)

# Send the JSON message to RabbitMQ
channel.basic_publish(exchange='', routing_key=queue_name, body=message_json)
print(f"Message sent to RabbitMQ: {message_json}")
```
In the previous code sketches, we have not implemented several key functions.  Let's fill in those functions now.  You'll need to position these functions near the top of your script.

### setup_blob_storage

Please use [this link](https://learn.microsoft.com/en-us/azure/storage/blobs/storage-quickstart-blobs-python?tabs=managed-identity%2Croles-azure-portal%2Csign-in-azure-cli) to learn about Azure Blob storage, account configuration, and Python code patterns.


``` python
container_name  =  "picturesblobstorage"
def  setup_blob_storage():
	connect_str  =  "Get connection string for your Azure storage account"
	blob_service_client  =  BlobServiceClient.from_connection_string(connect_str)
	container_client  =  blob_service_client.get_container_client(container_name)
	return  container_client
```
### setup_rabbit_message_queue

Setup connection to [message queue system](https://www.rabbitmq.com/tutorials/tutorial-one-python.html). 

``` python
def  setup_rabbit_message_queue():
	rabbitmq_host  =  'localhost'
	rabbitmq_port  =  5672
	rabbitmq_username  =  'guest'
	rabbitmq_password  =  'guest'
	queue_name  =  'review-picture-queue'

	# Initialize RabbitMQ connection and channel with authentication
	credentials  =  pika.PlainCredentials(rabbitmq_username, rabbitmq_password)
	connection  =  pika.BlockingConnection(pika.ConnectionParameters(host=rabbitmq_host,port=rabbitmq_port,credentials=credentials))
	channel  =  connection.channel()

	# Declare a queue for sending messages
	channel.queue_declare(queue=queue_name)
	return  queue_name,connection,channel
```
To keep this blog post brief, I will not be able to jump into all the details regarding setting up RabbitMQ on your local system.   Please refer to this 10-minute video for details on setting up this sub-system.   

<iframe width="560" height="315" src="https://www.youtube.com/embed/-0g-1ckQgBo?si=OIrNkq7TY-EZ2HJo" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>

This blog post does a great job of setting up RabbitMQ with "docker-compose."   It's a light weight way to setup stuff in your environment. 

[Easy RabbitMQ Deployment with Docker Compose (christian-schou.dk)](https://blog.christian-schou.dk/rabbitmq-deployment-with-docker-compose/)


### store_picture_on_disk

``` python
def  store_picture_on_disk(frame):
	timestamp  =  time.strftime("%Y%m%d%H%M%S")
	filename  =  f"image_{timestamp}.jpg"
	cv2.imwrite(filename, frame)
	return  timestamp,filename
```

In our final blog post, we'll use NodeJs to load the COCO-SSD model into memory and let it comment upon the image in question.

You can check out the code solution in progress at the following github repository.

[https://github.com/michaelprosario/birdWatcher](https://github.com/michaelprosario/birdWatcher)

Check out object-detection.js to see how how object detection will work.   Check out watcher.py for a completed version of this tutorial.
