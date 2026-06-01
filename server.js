const express = require('express'); 
const cors = require('cors');
const multer = require('multer');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors()); 
app.use(express.json()); 
app.use('/images', express.static('uploads')); 

// Ensure uploads directory exists 
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage, 
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit for standard photos 
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

        if (allowedTypes.includes(file.mimetype)){
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only jpeg, png, gif, and webp. '));
        }
    }
});

// In-memory hashmap storage for the easy project (use database otherwise)
const imageMetadata = new Map();

app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        service: 'Image Microservice',
        timestamp: new Date().toISOString(),
        endpoints: ['POST /upload', 'GET /images/:id', 'GET /images', 'DELETE /images/:id']
    });
});

function getImageSize(req) {
    return {
        width: parseInt(req.query.width) || null,
        height: parseInt(req.query.height) || null,
        quality: parseInt(req.query.quality) || 80
    };
}

async function processImage(imageBuffer, options){
    let processedImage = imageBuffer;

    if (options.width || options.height){
        processedImage = await sharp(imageBuffer)
    .resize(options.width, options.height, { fit: 'cover' })
    .jpeg({ quality: options.quality })
    .toBuffer();
    }
    return processedImage;
}

async function saveImageToDisk(processedImage, imageId){
    const filename = `${imageId}.jpg`;
    const filepath = path.join(uploadDir, filename);
    fs.writeFileSync(filepath, processedImage);
    
    return { filename, filepath };
}

async function storeImagedata(file, savedFile, options, imageId) {
    const mdata = {
        id: imageId,
        originalName: file.originalname,
        filename: savedFile.filename,
        mimeType: file.mimetype,
        fileSize: file.size,
        processedSize: file.processedImage?.length || file.buffer.length,
        width: options.width || null,
        height: options.height || null,
        quality: options.quality,
        url: `http://localhost:${PORT}/images/${savedFile.filename}`,
        uploadAt: new Date().toISOString()
    };
    
    imageMetadata.set(imageId, mdata);
    return mdata;
}
 
app.post('/upload', upload.single('image'), async (req, res) => {
    try {
        if (!req.file){
            return res.status(400).json({ error: 'No image file provided' });
        }

        const imageId = uuidv4(); // generates a unique random identifier (UUID v4)
        const imageOptions = getImageSize(req);
        const processedImage = await processImage(req.file.buffer, imageOptions);
        const savedFile = await saveImageToDisk(processedImage, imageId);
        
        const mData = await storeImagedata(req.file, savedFile, imageOptions, imageId);

        res.json({
            success: true, 
            image: mData,
            message: 'Image uploaded successfully'
        });

    } catch (error) {
        console.error('Upload error: ', error);
        res.status(500).json({ error: 'Failed to upload image' });
    }
}); 

app.get('/images/:id', (req, res) => {
    const image = imageMetadata.get(req.params.id);

    if (!image){
        return res.status(404).json({ error: 'Image not found'});
    }

    res.json(image);
});

app.get('/images', (req, res) => {
    const images = Array.from(imageMetadata.values());

    res.json({
        count: images.length,
        images: images
    });
});

app.delete('/images/:id', (req, res) => {
    const image = imageMetadata.get(req.params.id);

    if (!image){
        return res.status(404).json({ error: 'Image not found' });
    }

    // delete file from disk 
    const filepath = path.join(uploadDir, image.filename);
    if (fs.existsSync(filepath)){
        fs.unlinkSync(filepath);
    }

    imageMetadata.delete(req.params.id);

    res.json({ 
        success: true, 
        message: 'Image deleted successfully' 
    });
});

app.listen(PORT, () => {
    console.log(`Image microserivce running on port ${PORT}`);
 });

 
