## Setup

## How do you setup rabbitMQ?
- Install docker - https://docs.docker.com/engine/install/
- Inspect birdWatcher\docker-compose.yml. This file configures rabbitmq to load. RabbitMq enables computer programs to talk to each other.  You might think of it as a chat software for programs.  
- Open command line(bash, powershell)
- Navigate to project directory

``` bash
cd birdWatcher
docker-compose up -d
```

## How do you run the picture taking process?
- install Python 3
``` bash
cd birdWatcher
export AZURE_BLOB_STORAGE_CONNECTION_STRING="fix me"
pip install -r requirements.txt
python watcher.py
```

``` powershell
cd birdWatcher
$env:AZURE_BLOB_STORAGE_CONNECTION_STRING="fix me"
pip install -r requirements.txt
python watcher.py
```

## How do you setup the analysis process?
- Install nodejs
- Install npm
``` bash
cd birdWatcher
export AZURE_BLOB_STORAGE_CONNECTION_STRING="fix me"
export SUPABASEURL="fix me"
export SUPABASEKEY="fix me"
npm install
node job-processor.js
```
## References
- https://learn.microsoft.com/en-us/azure/storage/blobs/storage-quickstart-blobs-nodejs?tabs=managed-identity%2Croles-azure-portal%2Csign-in-azure-cli



