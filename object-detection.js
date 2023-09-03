const tf = require("@tensorflow/tfjs-node")

const cocosSSd = require("@tensorflow-models/coco-ssd")
const fs = require("fs");

let ObjectDetection = class {
    static async predict(image)
    {
        let model = await cocosSSd.load();
     
        const imageBuffer = await fs.readFileSync(image);
        const imageArray = tf.node.decodeImage(imageBuffer);
        
        // Reshape the image into a 3D tensor (height x width x channels)
        const height = imageArray.shape[0];
        const width = imageArray.shape[1];
        const channels = imageArray.shape[2];
        const tensor3D = tf.reshape(imageArray, [height, width, channels]);

        
        let predictions = await model.detect(tensor3D);
        return { predictions: predictions }
    }
}

async function main(){

    let image = "birds.png";
    result = await ObjectDetection.predict(image);
    console.log(result)

}

main();