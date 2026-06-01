const express = require('express'); 
const cors = require('cors');
const multer = require('multer');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware - functions that run between receiving a request and sending a response 
app.use(cors()); // allows frontend requests from backend without blocking by browser security policy
app.use(express.json()); // automatically parses json from request bodies and attaches to req.body
app.use('/images', express.static('uploads')); // returns the actual .jpg file from uploads/ folder 
                                            // url pattern: /images/filename (serves from uploads folder)

// Ensure uploads directory exists 
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer(file upload middleware ) with memory storage, size limits, and file type validation
// stores uploaded files as buffer objects in memory RAM instead of writing to disk
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

// In-memory storage for the easy project (use database otherwise)
// creates an empty Map object for storing key-value pairs
const imageMetadata = new Map();

// health check 
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        service: 'Image Microservice',
        timestamp: new Date().toISOString(),
        endpoints: ['POST /upload', 'GET /images/:id', 'GET /images', 'DELETE /images/:id']
    });
});

// 1. upload an image 
// upload.single('image') is Multer middleware that processes a single file upload from 
// a form field named 'image'. 
app.post('/upload', upload.single('image'), async (req, res) => {
    try {
        if (!req.file){
            return res.status(400).json({ error: 'No image file provided' });
        }

        const imageId = uuidv4(); // generates a unique random identifier (UUID v4)
        const originalName = req.file.originalname; 
        const mimeType = req.file.mimetype; 
        const fileSize = req.file.size; 

        // get optional parameters 
        const width = parseInt(req.query.width) || null;
        const height = parseInt(req.query.height) || null;
        const quality = parseInt(req.query.quality) || 80;

        let processedImage = req.file.buffer; // start with original image

        // process image if resize requested 
        // only when width or height provided
        if (width || height){
            processedImage = await sharp(req.file.buffer) // 
                .resize(width, height, { fit: 'cover' })
                .jpeg({ quality: quality })
                .toBuffer();
        }

        // save to disk with unique name 
        const filename = `${imageId}.jpg`;
        const filepath = path.join(uploadDir, filename);
        fs.writeFileSync(filepath, processedImage);

        // store metadata 
        imageMetadata.set(imageId, {
            id: imageId,
            originalName, 
            filename, 
            mimeType, 
            fileSize,
            processedSize: processedImage.length, 
            width: width || null, 
            height: height || null, 
            quality, 
            url: `http://localhost:${PORT}/images/${filename}`,
            uploadAt: new Date().toISOString()
        });

        res.json({
            success: true, 
            image: imageMetadata.get(imageId),
            message: 'Image uploaded successfully'
        });

    } catch (error) {
        console.error('Upload error: ', error);
        res.status(500).json({ error: 'Failed to upload image' });
    }
}); 

// 2. get image by id
app.get('/images/:id', (req, res) => {
    const image = imageMetadata.get(req.params.id);

    if (!image){
        return res.status(404).json({ error: 'Image not found'});
    }

    res.json(image);
});

// 3. get all images 
app.get('/images', (req, res) => {
    const images = Array.from(imageMetadata.values());

    res.json({
        count: images.length,
        images: images
    });
});

// 4. delete image 
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

    // delete metadata 
    imageMetadata.delete(req.params.id);

    res.json({ 
        success: true, 
        message: 'Image deleted successfully' 
    });
});

app.listen(PORT, () => {
    console.log(`Image microserivce running on port ${PORT}`);
 });

 