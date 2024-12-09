const fs = require('fs').promises;
const path = require('path');

const ensureUploadDir = async () => {
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'pages');
  try {
    await fs.mkdir(uploadDir, { recursive: true });
    console.log('Upload directory ensured:', uploadDir);
  } catch (error) {
    console.error('Error ensuring upload directory:', error);
    throw error;
  }
};

module.exports = ensureUploadDir; 