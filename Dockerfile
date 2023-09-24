# Use the official Node.js image as the base image
FROM node:latest

# Set the working directory in the container
WORKDIR /app

# Copy the package.json and package-lock.json files from the current directory to the working directory in the container
COPY package*.json ./

# Install the dependencies in the container
RUN npm install

# Copy the rest of the files from the current directory to the working directory in the container
COPY . .

# Expose port 3000 to the outside world
EXPOSE 3000

# Run the app.js file when the container starts
CMD ["node", "job-processor.js"]
