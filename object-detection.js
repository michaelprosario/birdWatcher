const tf = require("@tensorflow/tfjs-node")

const cocosSSd = require("@tensorflow-models/coco-ssd")
const fs = require("fs");
const { createCanvas, loadImage } = require('canvas');

let ObjectDetection = class 
{
    static async predict(image)
    {
        let model = await cocosSSd.load();
     
        const img = await loadImage(image);
        const canvas = createCanvas(img.width, img.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
      
        const predictions = await model.detect(canvas);
        
        return { predictions: predictions }
    }
}

async function main()
{
    let image = "birds.png";
    result = await ObjectDetection.predict(image);
    console.log(result)
}

main();