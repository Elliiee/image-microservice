import React, { useState, useEffect } from 'react';
import './App.css';

const API_URL = 'http://localhost:3001/api';
const IMAGE_API_URL = 'http://localhost:3002';

function App() {
  // Image microservice states 
  const [profileImage, setProfileImage] = useState(null);
  const [currentImageId, setCurrentImageId] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState('');

  // Helper function to handle fetch responses 
  const handleResponse = async (response) => {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `http error, status: ${response.status}`);
    }
    return response.json();
  }

  // Image upload function using Fetch 
  const uploadImage = async (file) => {
    setImageLoading(true); // show loading indicator 
    setImageError(''); // clear any previous errors 

    const formData = new FormData(); // create a FormData object (required for file uploads)
    formData.append('image', file); // append the image file name with the field name 'image'

    try {
      // send a POST request to the upload endpoint
      const response = await fetch(`${IMAGE_API_URL}/upload`, {
        method: 'POST',
        body: formData
        // Don't set Content-Type header - browser sets it with boundary for multipart/form-data
        // otherwise the browser automatically sets it to multipart/form-data; boundary=... which 
        // is required for file uploads. 
      });

      // Process response 
      const data = await handleResponse(response); // parse the response using a custom handleResponse function
      if (data.success) {
        setCurrentImageId(data.image.id); // update state with image id
        setImageUrl(data.image.url); // update image url 
        return data.image; 
      }
    } catch (err) {
      setImageError(`Failed to upload image: ${err.message}`);
      console.error('Upload error:', err);
    } finally {
      setImageLoading(false); // always hide loading indicator 
    }
  };

  // Handle the file selection 
  const handleImageSelect = async (e) => {
    const file = e.target.files[0];
    if (file) {
      await uploadImage(file);
    }
  };

  // Delete image 
  const deleteImage = async () => {
    if (!currentImageId) return; 

    if (window.confirm('Delete or update this image?')){
      setImageLoading(true);
      try {
        const response = await fetch(`${IMAGE_API_URL}/images/${currentImageId}`, {
          method: 'DELETE'
        });
        
        await handleResponse(response);
        setCurrentImageId(null);
        setImageUrl(null);
        setProfileImage(null);
      } catch (err) {
        setImageError('Failed to delete image');
      } finally {
        setImageLoading(false);
      }
    }
  };

  // update image 
  const updateImage = async (e) => {
    const file = e.target.files[0];
    if (file) {
      if (currentImageId){
        await deleteImage(); 
      }
      await uploadImage(file);
    }
  };

  return (
    <div className='App'>
      {/* Image section */}
      <div className="image-section">
        <div className="image-container">
          {imageUrl ? (
            <div className="image-preview">
              <img src={imageUrl} alt="Profile" />
              <div className="image-buttons">
                <label className="image-btn-small">
                  📷 Update
                  <input type="file" accept="image/*" onChange={updateImage} />
                </label>
                <button className="image-btn-small delete" onClick={deleteImage}>🗑️</button>
              </div>
            </div>
          ) : (
            <div className="image-upload">
              <label className="image-upload-label">
                📸 {imageLoading ? 'Uploading...' : 'Add Photo'}
                <input type="file" accept="image/*" onChange={handleImageSelect} />
              </label>
            </div>
          )}
          {imageError && <span className="image-error">{imageError}</span>}
        </div>
      </div>
      <header className='App-header'>
        <h1>Image demo</h1>
      </header>
    </div>
  );
}

export default App;