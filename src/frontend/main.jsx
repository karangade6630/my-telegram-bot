import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './blog.css';

const DEFAULT_BLOG_POSTS = [
	{
		id: 'post-1',
		title: 'Building Scalable REST APIs with Node.js and Express',
		category: 'Web Development',
		excerpt:
			'A practical look at designing scalable REST APIs with Express, middleware architecture, validation, error handling, authentication, and production-ready API patterns.',
		date: 'Aug 10, 2026',
		readTime: '7 min read',
		posterUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=600&q=80',
		rating: '9.1/10',
		genre: 'Node.js, Express, Backend',
	},
	{
		id: 'post-2',
		title: 'Cybersecurity Fundamentals Every Developer Should Know',
		category: 'Cybersecurity',
		excerpt:
			'Understanding authentication, authorization, secure headers, password protection, input validation, and common web vulnerabilities developers encounter every day.',
		date: 'Aug 9, 2026',
		readTime: '6 min read',
		posterUrl: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=600&q=80',
		rating: '8.9/10',
		genre: 'Security, Web, Privacy',
	},
	{
		id: 'post-3',
		title: 'Understanding Docker Containers for Modern Applications',
		category: 'DevOps',
		excerpt:
			'Learn how Docker images, containers, volumes, networks, and Docker Compose work together to create reproducible development and deployment environments.',
		date: 'Aug 8, 2026',
		readTime: '8 min read',
		posterUrl: 'https://images.unsplash.com/photo-1605745341112-85968b19335b?auto=format&fit=crop&w=600&q=80',
		rating: '9.3/10',
		genre: 'Docker, Containers, Deployment',
	},
	{
		id: 'post-4',
		title: 'Machine Learning Model Training: From Dataset to Deployment',
		category: 'Artificial Intelligence',
		excerpt:
			'A complete overview of the machine learning workflow, including dataset preparation, training, validation, evaluation metrics, model optimization, and deployment.',
		date: 'Aug 7, 2026',
		readTime: '9 min read',
		posterUrl: 'https://images.unsplash.com/photo-1555255707-c07966088b7b?auto=format&fit=crop&w=600&q=80',
		rating: '9.0/10',
		genre: 'AI, Machine Learning, Python',
	},
	{
		id: 'post-5',
		title: 'React Performance Optimization Techniques That Actually Matter',
		category: 'Web Development',
		excerpt:
			'Explore practical React performance techniques including memoization, lazy loading, code splitting, efficient rendering, state management, and component optimization.',
		date: 'Aug 6, 2026',
		readTime: '7 min read',
		posterUrl: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?auto=format&fit=crop&w=600&q=80',
		rating: '9.2/10',
		genre: 'React, JavaScript, Frontend',
	},
	{
		id: 'post-6',
		title: 'Zero Trust Architecture for Modern Cloud Infrastructure',
		category: 'Cybersecurity',
		excerpt:
			'How zero trust security models protect modern applications by continuously verifying users, devices, services, and network access instead of trusting internal traffic.',
		date: 'Aug 5, 2026',
		readTime: '8 min read',
		posterUrl: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=600&q=80',
		rating: '8.8/10',
		genre: 'Zero Trust, Cloud, Security',
	},
	{
		id: 'post-7',
		title: 'CI/CD Pipelines: Automating Testing and Deployment',
		category: 'DevOps',
		excerpt:
			'Discover how continuous integration and continuous deployment pipelines automate testing, builds, security checks, and application releases.',
		date: 'Aug 4, 2026',
		readTime: '6 min read',
		posterUrl: 'https://images.unsplash.com/photo-1618401471353-b98afee0b2eb?auto=format&fit=crop&w=600&q=80',
		rating: '9.0/10',
		genre: 'CI/CD, Automation, Git',
	},
	{
		id: 'post-8',
		title: 'Large Language Models Explained: Tokens, Context and Inference',
		category: 'Artificial Intelligence',
		excerpt:
			'A developer-friendly explanation of how large language models process tokens, understand context, generate responses, and perform inference.',
		date: 'Aug 3, 2026',
		readTime: '8 min read',
		posterUrl: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=600&q=80',
		rating: '9.4/10',
		genre: 'LLM, AI, Generative AI',
	},
	{
		id: 'post-9',
		title: 'PostgreSQL Database Design for High-Traffic Applications',
		category: 'Web Development',
		excerpt:
			'Learn how proper schema design, indexes, relationships, transactions, query optimization, and connection pooling improve database performance.',
		date: 'Aug 2, 2026',
		readTime: '7 min read',
		posterUrl: 'https://images.unsplash.com/photo-1544383835-bda2bc66a55d?auto=format&fit=crop&w=600&q=80',
		rating: '9.1/10',
		genre: 'PostgreSQL, SQL, Backend',
	},
	{
		id: 'post-10',
		title: 'Kubernetes Basics: Pods, Services and Deployments',
		category: 'DevOps',
		excerpt:
			'An introduction to Kubernetes architecture covering pods, deployments, services, scaling, configuration, and the fundamentals of container orchestration.',
		date: 'Aug 1, 2026',
		readTime: '9 min read',
		posterUrl: 'https://images.unsplash.com/photo-1667372393119-3d4c48d07fc9?auto=format&fit=crop&w=600&q=80',
		rating: '9.2/10',
		genre: 'Kubernetes, Cloud, Containers',
	},
	{
		id: 'post-11',
		title: 'How Phishing Attacks Trick Users and How to Prevent Them',
		category: 'Cybersecurity',
		excerpt:
			'A detailed look at phishing techniques, social engineering patterns, malicious links, credential theft, and practical ways to identify suspicious messages.',
		date: 'Jul 31, 2026',
		readTime: '5 min read',
		posterUrl: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=600&q=80',
		rating: '8.7/10',
		genre: 'Phishing, Privacy, Security',
	},
	{
		id: 'post-12',
		title: 'Computer Vision with YOLO: Real-Time Object Detection',
		category: 'Artificial Intelligence',
		excerpt:
			'Explore how YOLO-based computer vision systems detect objects in real time and how datasets, annotations, training, and inference work together.',
		date: 'Jul 30, 2026',
		readTime: '8 min read',
		posterUrl: 'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?auto=format&fit=crop&w=600&q=80',
		rating: '9.3/10',
		genre: 'YOLO, Computer Vision, AI',
	},
	{
		id: 'post-13',
		title: 'WebSockets vs REST APIs: Choosing the Right Communication Model',
		category: 'Web Development',
		excerpt:
			'Compare request-response APIs with persistent WebSocket connections and learn when real-time communication is the better architecture.',
		date: 'Jul 29, 2026',
		readTime: '6 min read',
		posterUrl: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=600&q=80',
		rating: '9.0/10',
		genre: 'WebSockets, REST, Real-Time',
	},
	{
		id: 'post-14',
		title: 'Cloud Infrastructure Monitoring and Observability',
		category: 'DevOps',
		excerpt:
			'Understand logs, metrics, traces, alerts, dashboards, and observability strategies for diagnosing issues in distributed cloud applications.',
		date: 'Jul 28, 2026',
		readTime: '7 min read',
		posterUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=600&q=80',
		rating: '8.9/10',
		genre: 'Monitoring, Cloud, Observability',
	},
	{
		id: 'post-15',
		title: 'Secure Authentication with JWT and Refresh Tokens',
		category: 'Cybersecurity',
		excerpt:
			'Learn how access tokens, refresh tokens, token expiration, secure cookies, and token rotation can be combined to build safer authentication systems.',
		date: 'Jul 27, 2026',
		readTime: '7 min read',
		posterUrl: 'https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?auto=format&fit=crop&w=600&q=80',
		rating: '9.2/10',
		genre: 'JWT, Authentication, Security',
	},
	{
		id: 'post-16',
		title: 'Building Recommendation Systems with Machine Learning',
		category: 'Artificial Intelligence',
		excerpt:
			'A beginner-friendly introduction to recommendation systems, collaborative filtering, content-based approaches, embeddings, and ranking algorithms.',
		date: 'Jul 26, 2026',
		readTime: '8 min read',
		posterUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=600&q=80',
		rating: '8.8/10',
		genre: 'Machine Learning, Data Science, AI',
	},
	{
		id: 'post-17',
		title: 'Git Branching Strategies for Professional Development Teams',
		category: 'DevOps',
		excerpt:
			'Compare Git Flow, trunk-based development, feature branches, pull requests, code reviews, and release strategies for collaborative software teams.',
		date: 'Jul 25, 2026',
		readTime: '6 min read',
		posterUrl: 'https://images.unsplash.com/photo-1556075798-4825dfaaf498?auto=format&fit=crop&w=600&q=80',
		rating: '9.1/10',
		genre: 'Git, Collaboration, DevOps',
	},
	{
		id: 'post-18',
		title: 'Understanding SQL Injection and Parameterized Queries',
		category: 'Cybersecurity',
		excerpt:
			'See how SQL injection vulnerabilities occur and why parameterized queries, prepared statements, validation, and least-privilege database access are essential.',
		date: 'Jul 24, 2026',
		readTime: '6 min read',
		posterUrl: 'https://images.unsplash.com/photo-1510511459019-5dda7724fd87?auto=format&fit=crop&w=600&q=80',
		rating: '9.4/10',
		genre: 'SQL Injection, Database, Security',
	},
	{
		id: 'post-19',
		title: 'Serverless Architecture: When Should You Use It?',
		category: 'Web Development',
		excerpt:
			'Explore serverless functions, event-driven applications, cold starts, scaling, pricing models, and the situations where serverless architecture makes sense.',
		date: 'Jul 23, 2026',
		readTime: '7 min read',
		posterUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=80',
		rating: '8.9/10',
		genre: 'Serverless, Cloud, Backend',
	},
	{
		id: 'post-20',
		title: 'AI Agents and Tool Calling: The Next Generation of Applications',
		category: 'Artificial Intelligence',
		excerpt:
			'Learn how AI agents combine language models with tools, APIs, memory, workflows, and external services to perform multi-step tasks autonomously.',
		date: 'Jul 22, 2026',
		readTime: '9 min read',
		posterUrl: 'https://images.unsplash.com/photo-1676299081847-824916de030a?auto=format&fit=crop&w=600&q=80',
		rating: '9.5/10',
		genre: 'AI Agents, LLM, Automation',
	},
];

const App = () => {
	const [mode, setMode] = useState('loading'); // 'loading' | 'bot_visitor' | 'normal_blog'
	const [data, setData] = useState(null);
	const [expiredNotice, setExpiredNotice] = useState(false);
	const [countdown, setCountdown] = useState(10);
	const [progress, setProgress] = useState(0);

	// Blog state
	const [recentMovies, setRecentMovies] = useState([]);
	const [searchQuery, setSearchQuery] = useState('');
	const [activeCategory, setActiveCategory] = useState('All');

	useEffect(() => {
		const searchParams = new URLSearchParams(window.location.search);
		const fileId = searchParams.get('fileId');
		const movieId = searchParams.get('movieId');
		const t = searchParams.get('t');

		// Check timestamp client-side for 10-minute validity
		const now = Date.now();
		const timestamp = Number(t);
		const TEN_MINUTES_MS = 10 * 60 * 1000;

		const isExpired = !t || isNaN(timestamp) || now - timestamp > TEN_MINUTES_MS || timestamp > now + 60000;

		if (isExpired) {
			if (t) setExpiredNotice(true);
			setMode('normal_blog');
			loadRecentMovies();
			return;
		}

		if (!fileId && !movieId) {
			setMode('normal_blog');
			loadRecentMovies();
			return;
		}

		// Fetch file & movie details from worker backend API
		const apiUrl = `/api/file-info?${searchParams.toString()}`;
		fetch(apiUrl)
			.then((res) => res.json())
			.then((resData) => {
				if (resData.ok) {
					setData(resData);
					setMode('bot_visitor');
				} else {
					if (resData.expired) setExpiredNotice(true);
					setMode('normal_blog');
					loadRecentMovies();
				}
			})
			.catch(() => {
				setMode('normal_blog');
				loadRecentMovies();
			});
	}, []);

	const loadRecentMovies = () => {
		fetch('/api/recent-movies')
			.then((res) => res.json())
			.then((resData) => {
				if (resData.ok && resData.movies && resData.movies.length > 0) {
					setRecentMovies(resData.movies);
				}
			})
			.catch(() => {});
	};

	// 10-second countdown timer for bot visitors
	useEffect(() => {
		if (mode !== 'bot_visitor') return;

		const timer = setInterval(() => {
			setCountdown((prev) => {
				if (prev <= 1) {
					clearInterval(timer);
					setProgress(100);
					return 0;
				}
				const next = prev - 1;
				setProgress(((10 - next) / 10) * 100);
				return next;
			});
		}, 1000);

		return () => clearInterval(timer);
	}, [mode]);

	const handleGetFileClick = () => {
		if (countdown > 0 || !data) return;
		const botName = data.botUsername || 'movie_time_v1_bot';
		const fileId = data.file?.id || '';
		const token = data.token || '';
		const telegramUrl = `https://t.me/${botName}?start=dl_${fileId}_${token}`;
		window.location.href = telegramUrl;
	};

	if (mode === 'loading') {
		return (
			<div
				style={{
					display: 'flex',
					height: '100vh',
					alignItems: 'center',
					justifyContent: 'center',
					backgroundColor: '#f0f4f8',
					color: '#334155',
				}}
			>
				<div style={{ textAlign: 'center' }}>
					<div className="logo-icon" style={{ margin: '0 auto 1rem', width: '56px', height: '56px', fontSize: '1.8rem' }}>
						🎬
					</div>
					<h3 style={{ fontSize: '1.25rem', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, color: '#0f172a' }}>
						Loading CineTech Daily...
					</h3>
					<p style={{ fontSize: '0.9rem', color: '#64748b', marginTop: '0.5rem' }}>Fetching digital cinema records &amp; media index</p>
				</div>
			</div>
		);
	}

	const movie = data?.movie;
	const file = data?.file;

	// Combine DB movies and default editorial posts for the blog grid
	const displayedPosts =
		recentMovies.length > 0
			? recentMovies.map((m) => ({
					id: `movie-${m.id}`,
					title: m.title,
					category: m.genre ? m.genre.split(',')[0] : 'Movie Review',
					excerpt:
						m.description ||
						`Indexed high-bitrate media release (${m.year || '2026'}). Complete audio tracks and verified container encodings.`,
					date: m.year ? `Released ${m.year}` : 'Indexed Recently',
					readTime: m.runtime || 'Verified File',
					posterUrl: m.posterUrl || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=600&q=80',
					rating: m.imdbRating ? `${m.imdbRating}/10` : '8.0/10',
					genre: m.genre || 'Action, Drama',
				}))
			: DEFAULT_BLOG_POSTS;

	// Filter posts based on search query and category pill
	const filteredPosts = displayedPosts.filter((post) => {
		const matchesSearch =
			searchQuery === '' ||
			post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
			post.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
			post.genre.toLowerCase().includes(searchQuery.toLowerCase());

		const matchesCategory =
			activeCategory === 'All' ||
			post.category.toLowerCase().includes(activeCategory.toLowerCase()) ||
			post.genre.toLowerCase().includes(activeCategory.toLowerCase());

		return matchesSearch && matchesCategory;
	});

	return (
		<div>
			{/* Top Header */}
			<header className="blog-header">
				<div className="header-container">
					<a href="/" className="logo-brand">
						<div className="logo-icon">🎬</div>
						<span>CineTech Daily</span>
					</a>

					<div className="header-search">
						<span>🔍</span>
						<input
							type="text"
							placeholder="Search movies, encodings..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
						/>
					</div>

					<ul className="nav-links">
						<li>
							<a href="/" className="active">
								Home
							</a>
						</li>
						<li>
							<a href="#blog-grid">Movies &amp; Shows</a>
						</li>
						<li>
							<a href="#blog-grid">Streaming Tech</a>
						</li>
						<li>
							<a href="#blog-grid">Reviews</a>
						</li>
						<li>
							<a href="#about">About</a>
						</li>
					</ul>
				</div>
			</header>

			{/* Hero Banner for normal blog view */}
			{mode === 'normal_blog' && (
				<section className="hero-banner">
					<div className="hero-content">
						<div className="hero-badge">
							<span>✨</span> Premier Digital Cinema &amp; Media Tech Journal
						</div>
						<h1 className="hero-title">High-Bitrate Cinema &amp; Cloud Archiving</h1>
						<p className="hero-subtitle">
							In-depth reviews, codec compression benchmarks, AV1 vs HEVC analysis, and master file metadata updated daily.
						</p>
						<div className="hero-stats">
							<div className="stat-item">
								<div className="stat-value">10,000+</div>
								<div className="stat-label">Indexed Releases</div>
							</div>
							<div className="stat-item">
								<div className="stat-value">4K HDR</div>
								<div className="stat-label">Master Encodes</div>
							</div>
							<div className="stat-item">
								<div className="stat-value">99.9%</div>
								<div className="stat-label">CDN Uptime</div>
							</div>
						</div>
					</div>
				</section>
			)}

			{/* Expiration Notice if accessed after 10 min */}
			{expiredNotice && (
				<div className="alert-banner">
					⚠️ <b>Security Session Expired:</b> This file link has passed the 10-minute Telegram verification window. Displaying the main
					CineTech blog catalog.
				</div>
			)}

			<div className="main-layout">
				{/* Main Content Area */}
				<main id="blog-grid">
					{mode === 'bot_visitor' && (file || movie) ? (
						/* BOT VISITOR MODE: Full Movie Details, Specs & 10s Countdown Security Terminal */
						<article className="article-card">
							<span className="article-category">Verified Media Index &amp; File Gateway</span>
							<h1 className="article-title">
								{movie?.title || file?.fileName} {movie?.year ? `(${movie.year})` : ''} — Official Review &amp; Access Terminal
							</h1>

							<div className="article-meta">
								<span>By CineTech Media Archive</span>
								<span>•</span>
								<span>Updated Today</span>
								<span>•</span>
								<span>DB Record #{file?.id || movie?.id}</span>
							</div>

							{/* Main Movie Poster & Detail Card */}
							<div className="movie-info-card">
								<div className="movie-poster-container">
									{movie?.posterUrl ? (
										<img
											src={movie.posterUrl}
											alt={movie.title}
											className="movie-poster"
											onError={(e) => {
												e.target.style.display = 'none';
												e.target.nextSibling.style.display = 'flex';
											}}
										/>
									) : null}
									<div className="poster-fallback" style={{ display: movie?.posterUrl ? 'none' : 'flex' }}>
										<div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🎬</div>
										<div>{movie?.title || file?.fileName}</div>
									</div>
								</div>

								<div className="movie-details">
									<h3>{movie?.title || file?.fileName}</h3>
									{movie?.originalTitle && <div className="original-title">Original Title: {movie.originalTitle}</div>}

									<div className="movie-tags">
										{movie?.imdbRating && (
											<span className="tag-badge tag-rating">
												⭐ IMDb: {movie.imdbRating}/10 {movie.imdbVotes ? `(${movie.imdbVotes} votes)` : ''}
											</span>
										)}
										{movie?.year && <span className="tag-badge">Year: {movie.year}</span>}
										{file?.quality && <span className="tag-badge tag-feature">Quality: {file.quality}</span>}
										{file?.size && <span className="tag-badge">Size: {file.size}</span>}
										{movie?.contentRating && <span className="tag-badge">Rated: {movie.contentRating}</span>}
										{movie?.runtime && <span className="tag-badge">Runtime: {movie.runtime}</span>}
										{movie?.language && <span className="tag-badge">Lang: {movie.language}</span>}
										{file?.isHevc && <span className="tag-badge tag-feature">HEVC</span>}
										{file?.isHdr && <span className="tag-badge tag-feature">HDR</span>}
										{file?.isDualAudio && <span className="tag-badge tag-feature">Dual Audio</span>}
									</div>

									{movie?.genre && (
										<div style={{ marginBottom: '0.75rem', fontSize: '0.92rem', color: '#4f46e5', fontWeight: 700 }}>
											<strong>Genre:</strong> {movie.genre}
										</div>
									)}

									<p className="movie-overview">
										{movie?.description ||
											'Full HD media file indexed in D1 database with verified audio tracks and optimized container encoding. Ready for high-speed transfer.'}
									</p>

									<div className="movie-credits">
										{movie?.director && (
											<span>
												<strong>Director:</strong> {movie.director}
											</span>
										)}
										{movie?.cast && (
											<span>
												<strong>Cast:</strong> {movie.cast}
											</span>
										)}
									</div>
								</div>
							</div>

							{/* Technical File Specifications Grid */}
							{file && (
								<div className="spec-box">
									<div className="spec-box-title">
										<span>📦</span>
										<span>Database File Technical Specifications</span>
									</div>
									<div className="spec-grid">
										<div className="spec-item">
											<div className="spec-label">File Name</div>
											<div className="spec-value" style={{ wordBreak: 'break-all', fontSize: '0.88rem' }}>
												{file.fileName}
											</div>
										</div>
										<div className="spec-item">
											<div className="spec-label">File Size</div>
											<div className="spec-value">{file.size}</div>
										</div>
										<div className="spec-item">
											<div className="spec-label">Quality Label</div>
											<div className="spec-value">{file.quality}</div>
										</div>
										{file.resolution && (
											<div className="spec-item">
												<div className="spec-label">Resolution</div>
												<div className="spec-value">{file.resolution}</div>
											</div>
										)}
										{file.codec && (
											<div className="spec-item">
												<div className="spec-label">Video Codec</div>
												<div className="spec-value">{file.codec.toUpperCase()}</div>
											</div>
										)}
										{file.audioTracks && (
											<div className="spec-item">
												<div className="spec-label">Audio Tracks</div>
												<div className="spec-value">{file.audioTracks}</div>
											</div>
										)}
										{file.subtitle && (
											<div className="spec-item">
												<div className="spec-label">Subtitles</div>
												<div className="spec-value">{file.subtitle}</div>
											</div>
										)}
										{file.episodeString && (
											<div className="spec-item">
												<div className="spec-label">Episode</div>
												<div className="spec-value">{file.episodeString}</div>
											</div>
										)}
									</div>
								</div>
							)}

							<div className="article-body">
								<p>
									This media asset is stored securely within the Telegram Cloud Network. Access validation via our 10-second security timer
									ensures optimal transfer speeds across Cloudflare edge locations while preventing hotlinking.
								</p>
							</div>

							{/* 10-Second File Unlock Terminal */}
							<div className="unlock-terminal">
								<div className="terminal-title">
									<span>🔒</span>
									<span>File Download Security Terminal</span>
								</div>

								<p className="terminal-status">
									{countdown > 0
										? `⏳ Please wait ${countdown} seconds to unlock your Telegram file link...`
										: '✅ File Link Successfully Unlocked! Click below to send to your Telegram app.'}
								</p>

								{countdown > 0 ? (
									<div className="countdown-circle">{countdown}</div>
								) : (
									<div
										className="countdown-circle"
										style={{ borderColor: '#10b981', color: '#10b981', background: 'rgba(16, 185, 129, 0.2)' }}
									>
										✓
									</div>
								)}

								<div className="progress-container">
									<div className="progress-bar" style={{ width: `${progress}%` }}></div>
								</div>

								<button
									className={`btn-get-file ${countdown > 0 ? 'btn-disabled' : 'btn-active'}`}
									disabled={countdown > 0}
									onClick={handleGetFileClick}
								>
									{countdown > 0 ? <span>⏳ Preparing Link ({countdown}s)...</span> : <span>📥 Get Movie File in Telegram</span>}
								</button>
							</div>
						</article>
					) : (
						/* NORMAL BLOG MODE: Public Blog View with Grid of Movies & Articles */
						<div>
							<div className="blog-grid-header">
								<h2 className="blog-grid-title">Latest Reviews &amp; Releases</h2>

								<div className="filter-pills">
									{['All', 'Action', 'Comedy', 'Drama', 'Thriller', 'Tech'].map((cat) => (
										<button
											key={cat}
											className={`pill-btn ${activeCategory === cat ? 'active' : ''}`}
											onClick={() => setActiveCategory(cat)}
										>
											{cat}
										</button>
									))}
								</div>
							</div>

							{filteredPosts.length === 0 ? (
								<div className="article-card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
									<div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔎</div>
									<h3 style={{ fontSize: '1.3rem', marginBottom: '0.5rem' }}>No matching articles found</h3>
									<p style={{ color: '#64748b' }}>Try adjusting your search query or category filter.</p>
								</div>
							) : (
								<div className="blog-grid">
									{filteredPosts.map((post) => (
										<article key={post.id} className="blog-card">
											<div className="blog-card-img-wrapper">
												<img
													src={post.posterUrl}
													alt={post.title}
													className="blog-card-img"
													onError={(e) => {
														e.target.src = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=600&q=80';
													}}
												/>
												<span className="blog-card-badge">⭐ {post.rating}</span>
											</div>

											<div className="blog-card-body">
												<span
													className="article-category"
													style={{ fontSize: '0.75rem', marginBottom: '0.5rem', padding: '0.2rem 0.6rem' }}
												>
													{post.category}
												</span>
												<h3 className="blog-card-title">{post.title}</h3>
												<p className="blog-card-excerpt">{post.excerpt}</p>

												<div className="blog-card-footer">
													<span>{post.date}</span>
													<span className="read-more-link">Read Review →</span>
												</div>
											</div>
										</article>
									))}
								</div>
							)}
						</div>
					)}
				</main>

				{/* Sidebar */}
				<aside id="about">
					<div className="sidebar-card">
						<h3 className="sidebar-title">Trending Topics</h3>
						<div className="recent-post">
							<h4>Understanding HEVC vs AV1 Codec Benchmarks</h4>
							<span>Media Tech • 4 min read</span>
						</div>
						<div className="recent-post">
							<h4>Top 10 Cinematic Masterpieces Released This Month</h4>
							<span>Film Review • 6 min read</span>
						</div>
						<div className="recent-post">
							<h4>Cloudflare Edge CDN Acceleration for Bot Gateways</h4>
							<span>Architecture • 5 min read</span>
						</div>
					</div>

					<div className="sidebar-card">
						<h3 className="sidebar-title">About CineTech</h3>
						<p style={{ color: '#475569', fontSize: '0.92rem', lineHeight: '1.65' }}>
							CineTech Daily is a premier tech and cinema publication exploring digital film compression, high-bitrate encodings, and cloud
							worker architectures.
						</p>
					</div>

					<div className="sidebar-card" style={{ background: 'linear-gradient(135deg, #4f46e5, #0d9488)', color: '#ffffff' }}>
						<h3 className="sidebar-title" style={{ color: '#ffffff', borderColor: '#ffffff' }}>
							Telegram Bot Access
						</h3>
						<p style={{ fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '1rem', color: '#e0e7ff' }}>
							Connect directly with our automated Telegram Bot to index, search, and transfer high-bitrate media releases seamlessly.
						</p>
						<a
							href="https://t.me/movie_time_v1_bot"
							target="_blank"
							rel="noreferrer"
							style={{
								display: 'inline-block',
								background: '#ffffff',
								color: '#4f46e5',
								fontWeight: 800,
								padding: '0.6rem 1.25rem',
								borderRadius: '8px',
								textDecoration: 'none',
								fontSize: '0.9rem',
							}}
						>
							Launch Bot 🤖
						</a>
					</div>
				</aside>
			</div>

			{/* Footer */}
			<footer className="blog-footer">
				<div style={{ maxWidth: '1240px', margin: '0 auto' }}>
					<p>© 2026 CineTech Daily. All rights reserved. Powered by Cloudflare Workers &amp; Telegram Bot Architecture.</p>
					<p style={{ marginTop: '0.5rem', fontSize: '0.82rem', color: '#64748b' }}>
						Verified Media Index • Edge Content CDN • Security Gateways
					</p>
				</div>
			</footer>
		</div>
	);
};

createRoot(document.getElementById('root')).render(<App />);
