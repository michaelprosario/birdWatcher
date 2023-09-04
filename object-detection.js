const tf = require("@tensorflow/tfjs-node")
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

async function main()
{
    let image = "birds.png";
    result = await new ObjectDetection().predict(image);
    console.log(result)
}

main();