import React from 'react';
import { createRoot } from 'react-dom/client';

const App = () => (
	<div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
		<h1>Movie Bot Dashboard</h1>
		<p>Welcome to the dashboard for your worker backend.</p>
	</div>
);

createRoot(document.getElementById('root')).render(<App />);
