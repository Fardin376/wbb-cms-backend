const fs = require('fs').promises;
const path = require('path');

const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    res.status(200).json({
      success: true,
      message: 'File uploaded successfully',
      file: {
        filename: req.file.filename,
        path: `/uploads/${req.file.filename}`
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading file'
    });
  }
};

const getAllPublicImages = async (req, res) => {
  try {
    const uploadsDir = path.join(__dirname, '../../public/uploads');
    const files = await fs.readdir(uploadsDir);
    
    const images = files.filter(file => 
      /\.(jpg|jpeg|png|gif|webp)$/i.test(file)
    ).map(filename => ({
      filename,
      url: `/uploads/${filename}`
    }));

    res.status(200).json({
      success: true,
      data: images
    });
  } catch (error) {
    console.error('Error getting images:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching images'
    });
  }
};

const deletePublicImage = async (req, res) => {
  try {
    const filename = req.params.filename;
    const filepath = path.join(__dirname, '../../public/uploads', filename);

    await fs.unlink(filepath);

    res.status(200).json({
      success: true,
      message: 'File deleted successfully'
    });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting file'
    });
  }
};

module.exports = {
  uploadImage,
  getAllPublicImages,
  deletePublicImage
}; 