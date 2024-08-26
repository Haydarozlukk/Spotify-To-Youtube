import React, { useState } from 'react';
import axios from 'axios';
import './App.css'; // Stil dosyasını dahil edin

function App() {
    const [url, setUrl] = useState('');
    const [response, setResponse] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const result = await axios.post('http://localhost:5000/convert', { url });
            setResponse(result.data.message);
        } catch (error) {
            console.error("There was an error!", error);
            setResponse("Error: Could not convert the URL.");
        }
    };

    return (
        <div className="App">
            <h1>Spotify to YouTube Converter</h1>
            <form onSubmit={handleSubmit}>
                <input 
                    type="text" 
                    value={url} 
                    onChange={(e) => setUrl(e.target.value)} 
                    placeholder="Enter Spotify URL" 
                />
                <button type="submit">Convert</button>
            </form>
            <p>{response}</p>
        </div>
    );
}

export default App;
