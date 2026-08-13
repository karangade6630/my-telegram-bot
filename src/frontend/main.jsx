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
	const [mode, setMode] = useState('loading'); // 'loading' | 'bot_visitor' | 'normal_blog' | 'admin'
	const [data, setData] = useState(null);
	const [expiredNotice, setExpiredNotice] = useState(false);
	const [countdown, setCountdown] = useState(10);
	const [progress, setProgress] = useState(0);
	// Public Blog state
	const [recentMovies, setRecentMovies] = useState([]);
	const [searchQuery, setSearchQuery] = useState('');
	const [activeCategory, setActiveCategory] = useState('All');

	// Admin Auth & LocalStorage State
	const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(() => {
		return localStorage.getItem('cinetech_admin_auth') === 'true';
	});
	const [adminPasswordInput, setAdminPasswordInput] = useState('');
	const [adminLoginError, setAdminLoginError] = useState('');
	const [adminLoginLoading, setAdminLoginLoading] = useState(false);

	// Admin Dashboard state
	const [adminMovies, setAdminMovies] = useState([]);
	const [adminTotal, setAdminTotal] = useState(0);
	const [adminPage, setAdminPage] = useState(1);
	const [adminTotalPages, setAdminTotalPages] = useState(1);
	const [adminSearch, setAdminSearch] = useState('');
	const [adminGenre, setAdminGenre] = useState('');
	const [adminLoading, setAdminLoading] = useState(false);

	// Edit Modal State
	const [editingMovie, setEditingMovie] = useState(null);
	const [editFormData, setEditFormData] = useState({});
	const [omdbQuery, setOmdbQuery] = useState('');
	const [omdbStatus, setOmdbStatus] = useState('');
	const [saveStatus, setSaveStatus] = useState('');

	// Preview / Confirmation Modal State
	const [previewResult, setPreviewResult] = useState(null);
	const [showPreviewModal, setShowPreviewModal] = useState(false);
	console.log({ progress, countdown, previewResult, showPreviewModal });

	useEffect(() => {
		const pathname = window.location.pathname;
		const searchParams = new URLSearchParams(window.location.search);

		// Check for /admin route
		if (pathname === '/admin' || searchParams.has('admin')) {
			setMode('admin');
			if (isAdminAuthenticated) {
				loadAdminMovies(1, '', '');
			}
			return;
		}

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
		const apiUrl = `https://its-time-to.watch-movie.workers.dev/api/file-info?${searchParams.toString()}`;
		fetch(apiUrl)
			.then((res) => res.json())
			.then((resData) => {
				console.debug('[frontend] /api/file-info response', resData);
				if (resData.ok) {
					// Support wrapped payloads: { ok, data: { movie, file } } or { ok, result: { ... } }
					const payload = resData.data ?? resData.result ?? resData;
					console.debug('[frontend] /api/file-info payload', payload);
					setData(payload);
					setMode('bot_visitor');
				} else {
					if (resData.expired) setExpiredNotice(true);
					setMode('normal_blog');
					loadRecentMovies();
				}
			})
			.catch((err) => {
				console.error('[frontend] /api/file-info fetch error', err);
				setMode('normal_blog');
				loadRecentMovies();
			});
	}, []);

	// Ensure page scrolling is locked while preview modal is open so overlay is visible and background doesn't scroll
	useEffect(() => {
		try {
			if (showPreviewModal) {
				document.body.classList.add('modal-open');
			} else {
				document.body.classList.remove('modal-open');
			}
		} catch (e) {
			// Defensive - ignore when document not available in test env
		}
		return () => {
			try {
				document.body.classList.remove('modal-open');
			} catch (e) {}
		};
	}, [showPreviewModal]);

	const loadRecentMovies = () => {
		fetch('/api/recent-movies')
			.then((res) => res.json())
			.then((resData) => {
				console.debug('[frontend] /api/recent-movies response', resData);
				if (resData.ok && resData.movies && resData.movies.length > 0) {
					setRecentMovies(resData.movies);
				}
			})
			.catch((err) => {
				console.error('[frontend] /api/recent-movies fetch error', err);
			});
	};

	// Admin Password Login Verification
	const handleAdminLoginSubmit = (e) => {
		e.preventDefault();
		if (!adminPasswordInput) return;

		setAdminLoginLoading(true);
		setAdminLoginError('');

		fetch('/api/admin/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ password: adminPasswordInput }),
		})
			.then((res) => res.json())
			.then((resData) => {
				setAdminLoginLoading(false);
				if (resData.ok) {
					setIsAdminAuthenticated(true);
					localStorage.setItem('cinetech_admin_auth', 'true');
					setAdminPasswordInput('');
					loadAdminMovies(1, '', '');
				} else {
					setAdminLoginError('❌ Invalid password. Default admin password is admin123');
				}
			})
			.catch((err) => {
				setAdminLoginLoading(false);
				setAdminLoginError(`❌ Login error: ${err.message}`);
			});
	};

	// Admin Logout
	const handleAdminLogout = () => {
		setIsAdminAuthenticated(false);
		localStorage.removeItem('cinetech_admin_auth');
		setAdminPasswordInput('');
		setAdminLoginError('');
	};

	const loadAdminMovies = (page = 1, search = '', genre = '') => {
		setAdminLoading(true);
		const url = `https://its-time-to.watch-movie.workers.dev/api/admin/movies?page=${page}&limit=10&search=${encodeURIComponent(search)}&genre=${encodeURIComponent(genre)}`;
		fetch(url)
			.then((res) => res.json())
			.then((resData) => {
				setAdminLoading(false);
				if (resData.ok) {
					setAdminMovies(resData.movies || []);
					setAdminTotal(resData.total || 0);
					setAdminPage(resData.page || 1);
					setAdminTotalPages(resData.totalPages || 1);
				}
			})
			.catch(() => {
				setAdminLoading(false);
			});
	};

	// Handle Admin Search & Genre Filter
	const handleAdminSearchChange = (e) => {
		const val = e.target.value;
		setAdminSearch(val);
		loadAdminMovies(1, val, adminGenre);
	};

	const handleAdminGenreChange = (e) => {
		const val = e.target.value;
		setAdminGenre(val);
		loadAdminMovies(1, adminSearch, val);
	};

	const handleAdminPageChange = (newPage) => {
		if (newPage < 1 || newPage > adminTotalPages) return;
		loadAdminMovies(newPage, adminSearch, adminGenre);
	};

	// Open Edit Modal
	const handleOpenEdit = (movie) => {
		setEditingMovie(movie);
		setEditFormData({ ...movie });
		setOmdbQuery(movie.title || '');
		setOmdbStatus('');
		setSaveStatus('');
	};

	// Close Edit Modal
	const handleCloseEdit = () => {
		setEditingMovie(null);
		setEditFormData({});
	};

	// Helper to merge comma-separated values cleanly
	const mergeCommaStrings = (existing, incoming) => {
		const set = new Set();
		[existing, incoming].forEach((str) => {
			if (str && typeof str === 'string') {
				str.split(/[,|/]+/).forEach((p) => {
					const t = p.trim();
					if (t) set.add(t);
				});
			}
		});
		return set.size > 0 ? Array.from(set).join(', ') : null;
	};

	// Search OMDb and Auto-Fill Form
	const handleOmdbSearch = () => {
		if (!omdbQuery.trim()) return;
		setOmdbStatus('🔍 Searching OMDb & IMDb metadata...');
		const url = `https://its-time-to.watch-movie.workers.dev/api/admin/omdb-search?query=${encodeURIComponent(omdbQuery)}&year=${editFormData.year || ''}`;
		fetch(url)
			.then((res) => res.json())
			.then((resData) => {
				if (resData.ok && resData.result) {
					const meta = resData.result;
					setEditFormData((prev) => ({
						...prev,
						title: prev.title || meta.title,
						year: meta.year || prev.year,
						type: meta.type || prev.type || 'movie',
						genre: mergeCommaStrings(prev.genre, meta.genre) || meta.genre || prev.genre,
						language: mergeCommaStrings(prev.language, meta.language) || meta.language || prev.language,
						description: meta.description || prev.description,
						director: meta.director || prev.director,
						cast: meta.cast || prev.cast,
						runtime: meta.runtime || prev.runtime,
						contentRating: meta.contentRating || prev.contentRating,
						imdbRating: meta.imdbRating || prev.imdbRating,
						imdbVotes: meta.imdbVotes || prev.imdbVotes,
						imdbId: meta.imdbId || prev.imdbId,
						posterUrl: meta.posterUrl || prev.posterUrl,
						trailerUrl: meta.trailerUrl || prev.trailerUrl,
					}));
					setOmdbStatus('✅ OMDb & IMDb metadata auto-filled successfully! Genres and Languages merged.');
				} else {
					setOmdbStatus(`⚠️ ${resData.message || 'No metadata record found.'}`);
				}
			})
			.catch((err) => {
				setOmdbStatus(`❌ Error searching OMDb: ${err.message}`);
			});
	};

	// Save Movie Updates
	const handleSaveMovie = (e) => {
		e.preventDefault();
		setSaveStatus('🔎 Previewing changes...');
		// First request a preview of affected rows
		fetch('https://its-time-to.watch-movie.workers.dev/api/admin/movies/update', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ ...editFormData, preview: true }),
		})
			.then((res) => res.json())
			.then((resData) => {
				if (resData.ok && resData.preview) {
					setPreviewResult(resData.preview);
					if (resData.preview.preview && resData.preview.preview.length > 0) {
						setShowPreviewModal(true);
						setSaveStatus('⚠️ Confirm propagation to affected entries');
					} else {
						// No propagated changes; apply directly
						console.error('Preview result:', resData.preview);
						applyConfirmedSave();
					}
				} else {
					setSaveStatus(`❌ Preview failed: ${resData.message || 'unknown'}`);
					console.error('Preview failed response:', resData);
				}
			})
			.catch((err) => {
				setSaveStatus(`❌ Preview failed: ${err.message}`);
				console.error('Preview failed error:', err);
			});
	};

	const applyConfirmedSave = () => {
		setSaveStatus('💾 Applying updates...');
		fetch('https://its-time-to.watch-movie.workers.dev/api/admin/movies/update', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(editFormData),
		})
			.then((res) => res.json())
			.then((resData) => {
				if (resData.ok) {
					setSaveStatus('✅ Saved successfully!');
					setShowPreviewModal(false);
					setPreviewResult(null);
					setTimeout(() => {
						handleCloseEdit();
						loadAdminMovies(adminPage, adminSearch, adminGenre);
					}, 800);
				} else {
					setSaveStatus(`❌ Save failed: ${resData.message}`);
					console.error('Save failed response:', resData);
				}
			})
			.catch((err) => {
				setSaveStatus(`❌ Save failed: ${err.message}`);
			});
	};

	const cancelPreview = () => {
		setShowPreviewModal(false);
		setPreviewResult(null);
		setSaveStatus('✖️ Update canceled');
	};

	// Delete Movie
	const handleDeleteMovie = (movieId, movieTitle) => {
		if (!window.confirm(`Are you sure you want to delete "${movieTitle}"?`)) return;
		fetch('https://its-time-to.watch-movie.workers.dev/api/admin/movies/delete', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id: movieId }),
		})
			.then((res) => res.json())
			.then((resData) => {
				if (resData.ok) {
					loadAdminMovies(adminPage, adminSearch, adminGenre);
				} else {
					alert(`Delete failed: ${resData.message}`);
				}
			})
			.catch((err) => {
				alert(`Delete failed: ${err.message}`);
			});
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

	const movie = data?.movie ?? data?.model ?? data?.record ?? null;
	const file = data?.file ?? data?.fileInfo ?? null;

	// Combine DB movies and default editorial posts for the public blog grid
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

	// Filter posts based on search query and category pill for public blog
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
					<a
						href="/"
						className="logo-brand"
						onClick={(e) => {
							e.preventDefault();
							window.history.pushState({}, '', '/');
							setMode('normal_blog');
							loadRecentMovies();
						}}
					>
						<div className="logo-icon">🎬</div>
						<span>CineTech Daily</span>
					</a>

					{mode !== 'admin' && (
						<div className="header-search">
							<span>🔍</span>
							<input
								type="text"
								placeholder="Search movies, encodings..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
							/>
						</div>
					)}

					<ul className="nav-links">
						<li>
							<a
								href="/"
								className={mode === 'normal_blog' ? 'active' : ''}
								onClick={(e) => {
									e.preventDefault();
									window.history.pushState({}, '', '/');
									setMode('normal_blog');
									loadRecentMovies();
								}}
							>
								Home
							</a>
						</li>
						<li>
							<a
								href="/#blog-grid"
								onClick={() => {
									if (mode !== 'normal_blog') setMode('normal_blog');
								}}
							>
								Movies &amp; Shows
							</a>
						</li>
						<li>
							<a
								href="/admin"
								className={mode === 'admin' ? 'active' : ''}
								onClick={(e) => {
									e.preventDefault();
									window.history.pushState({}, '', '/admin');
									setMode('admin');
									if (isAdminAuthenticated) {
										loadAdminMovies(1, '', '');
									}
								}}
							>
								⚙️ Admin
							</a>
						</li>
					</ul>
				</div>
			</header>

			{/* ADMIN VIEW */}
			{mode === 'admin' ? (
				!isAdminAuthenticated ? (
					/* ADMIN LOGIN FORM SCREEN */
					<div className="admin-container" style={{ maxWidth: '460px', marginTop: '4rem' }}>
						<div className="article-card" style={{ padding: '2.5rem 2rem', textAlign: 'center' }}>
							<div
								className="logo-icon"
								style={{
									margin: '0 auto 1.25rem',
									width: '64px',
									height: '64px',
									fontSize: '2rem',
									borderRadius: '16px',
								}}
							>
								🔒
							</div>
							<h1
								style={{
									fontFamily: 'Space Grotesk, sans-serif',
									fontSize: '1.75rem',
									fontWeight: 800,
									color: '#0f172a',
									marginBottom: '0.5rem',
								}}
							>
								Admin Security Access
							</h1>
							<p style={{ color: '#64748b', fontSize: '0.92rem', marginBottom: '2rem', lineHeight: '1.5' }}>
								Enter your admin password to access the database management dashboard.
							</p>

							<form onSubmit={handleAdminLoginSubmit}>
								<div className="form-group" style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
									<label className="form-label">Admin Password</label>
									<input
										type="password"
										className="form-input"
										placeholder="Enter admin password..."
										required
										value={adminPasswordInput}
										onChange={(e) => setAdminPasswordInput(e.target.value)}
									/>
								</div>

								{adminLoginError && (
									<div
										style={{
											marginBottom: '1.5rem',
											padding: '0.75rem 1rem',
											borderRadius: '8px',
											background: '#fee2e2',
											color: '#dc2626',
											fontSize: '0.88rem',
											fontWeight: 700,
											textAlign: 'left',
										}}
									>
										{adminLoginError}
									</div>
								)}

								<button
									type="submit"
									className="btn-get-file btn-active"
									disabled={adminLoginLoading}
									style={{ width: '100%', maxWidth: 'none', padding: '0.9rem' }}
								>
									{adminLoginLoading ? '⏳ Verifying...' : '🔑 Unlock Admin Dashboard'}
								</button>
							</form>

							{/* PREVIEW / CONFIRMATION MODAL */}
							{console.log('Rendering preview modal with result:', previewResult)}

							<div
								style={{
									marginTop: '1.75rem',
									fontSize: '0.82rem',
									color: '#94a3b8',
									borderTop: '1px solid #e2e8f0',
									paddingTop: '1.25rem',
								}}
							>
								🔑 Default admin password: <strong style={{ color: '#4f46e5' }}>only admin can access this sorry</strong>
							</div>
						</div>
					</div>
				) : (
					/* FULL AUTHENTICATED ADMIN DASHBOARD */
					<div className="admin-container">
						{/* Admin Top Header */}
						<div className="admin-header-card">
							<div>
								<h1 className="admin-title">
									<span>⚙️</span> Movie Database Management
								</h1>
								<p style={{ color: '#64748b', fontSize: '0.95rem', marginTop: '0.25rem' }}>
									View, search, edit, and enrich movie metadata records in D1 Database.
								</p>
							</div>

							<div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
								<span className="tag-badge tag-feature" style={{ fontSize: '0.9rem', padding: '0.4rem 0.9rem' }}>
									Total Movies: <strong>{adminTotal}</strong>
								</span>
								<button className="admin-btn admin-btn-danger" onClick={handleAdminLogout}>
									🚪 Logout
								</button>
							</div>

							{/* Search & Genre Filter Toolbar */}
							<div className="admin-toolbar">
								<input
									type="text"
									className="admin-input"
									placeholder="🔍 Search title, original title, or slug..."
									style={{ flex: 1, minWidth: '240px' }}
									value={adminSearch}
									onChange={handleAdminSearchChange}
								/>

								<select className="admin-select" value={adminGenre} onChange={handleAdminGenreChange}>
									<option value="">All Genres</option>
									<option value="Action">Action</option>
									<option value="Comedy">Comedy</option>
									<option value="Crime">Crime</option>
									<option value="Drama">Drama</option>
									<option value="Thriller">Thriller</option>
									<option value="Sci-Fi">Sci-Fi</option>
									<option value="Adventure">Adventure</option>
									<option value="Mystery">Mystery</option>
								</select>

								<button className="admin-btn admin-btn-secondary" onClick={() => loadAdminMovies(adminPage, adminSearch, adminGenre)}>
									🔄 Refresh
								</button>
							</div>
						</div>

						{/* Admin Movies Data Table */}
						<div className="admin-table-wrapper">
							{adminLoading ? (
								<div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
									<div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
									<p>Loading database movies...</p>
								</div>
							) : adminMovies.length === 0 ? (
								<div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
									<div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎬</div>
									<p style={{ fontSize: '1.1rem', fontWeight: 700 }}>No movies found in database.</p>
									<p style={{ fontSize: '0.9rem' }}>Movies are automatically indexed when posted to Telegram channels.</p>
								</div>
							) : (
								<table className="admin-table">
									<thead>
										<tr>
											<th>Poster</th>
											<th>ID / Title</th>
											<th>Year / Type</th>
											<th>IMDb Rating</th>
											<th>Director / Cast</th>
											<th>Genre</th>
											<th style={{ textAlign: 'right' }}>Actions</th>
										</tr>
									</thead>
									<tbody>
										{adminMovies.map((m) => (
											<tr key={m.id}>
												<td>
													{m.posterUrl ? (
														<img
															src={m.posterUrl}
															alt={m.title}
															className="admin-thumb"
															onError={(e) => {
																e.target.style.display = 'none';
															}}
														/>
													) : (
														<div
															className="admin-thumb"
															style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}
														>
															🎬
														</div>
													)}
												</td>
												<td>
													<div style={{ fontWeight: 800, color: '#0f172a' }}>{m.title}</div>
													{m.originalTitle && <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{m.originalTitle}</div>}
													<div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
														ID: #{m.id} • Slug: {m.slug}
													</div>
												</td>
												<td>
													<div style={{ fontWeight: 700 }}>{m.year || 'N/A'}</div>
													<span className="tag-badge" style={{ fontSize: '0.72rem', textTransform: 'uppercase' }}>
														{m.type || 'movie'}
													</span>
												</td>
												<td>
													{m.imdbRating ? (
														<span className="tag-badge tag-rating">⭐ {m.imdbRating}/10</span>
													) : (
														<span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Not rated</span>
													)}
												</td>
												<td style={{ maxWidth: '200px' }}>
													<div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>{m.director || 'N/A'}</div>
													<div
														style={{
															fontSize: '0.78rem',
															color: '#64748b',
															overflow: 'hidden',
															textOverflow: 'ellipsis',
															whiteSpace: 'nowrap',
														}}
													>
														{m.cast || 'N/A'}
													</div>
												</td>
												<td style={{ fontSize: '0.85rem', color: '#4f46e5', fontWeight: 600 }}>{m.genre || 'N/A'}</td>
												<td style={{ textAlign: 'right' }}>
													<div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
														<button className="admin-btn admin-btn-primary" onClick={() => handleOpenEdit(m)}>
															✏️ Edit
														</button>
														<button className="admin-btn admin-btn-danger" onClick={() => handleDeleteMovie(m.id, m.title)}>
															🗑️ Delete
														</button>
													</div>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							)}

							{/* Admin Pagination */}
							<div className="admin-pagination">
								<div style={{ fontSize: '0.88rem', color: '#64748b' }}>
									Showing Page <strong>{adminPage}</strong> of <strong>{adminTotalPages}</strong> (Total <strong>{adminTotal}</strong>{' '}
									records)
								</div>
								<div style={{ display: 'flex', gap: '0.5rem' }}>
									<button
										className="admin-btn admin-btn-secondary"
										disabled={adminPage <= 1}
										onClick={() => handleAdminPageChange(adminPage - 1)}
									>
										← Previous
									</button>
									<button
										className="admin-btn admin-btn-secondary"
										disabled={adminPage >= adminTotalPages}
										onClick={() => handleAdminPageChange(adminPage + 1)}
									>
										Next →
									</button>
								</div>
							</div>
						</div>

						{/* EDIT MOVIE MODAL */}
						{editingMovie && (
							<div className="modal-overlay" onClick={handleCloseEdit}>
								<div className="modal-content" onClick={(e) => e.stopPropagation()}>
									<div className="modal-header">
										<h2 className="modal-title">✏️ Edit Movie Record #{editingMovie.id}</h2>
										<button className="modal-close" onClick={handleCloseEdit}>
											✕
										</button>
									</div>

									{/* OMDb / IMDb Search Box for Auto-Fill */}
									<div className="omdb-box">
										<div className="omdb-box-title">
											<span>🎬</span> Search OMDb / IMDb to Auto-Fill All Metadata Fields
										</div>
										<div className="omdb-search-flex">
											<input
												type="text"
												className="form-input"
												style={{ flex: 1 }}
												placeholder="Enter movie title or IMDb ID (e.g. Luke Cage, Wieners)..."
												value={omdbQuery}
												onChange={(e) => setOmdbQuery(e.target.value)}
											/>
											<button type="button" className="admin-btn admin-btn-success" onClick={handleOmdbSearch}>
												🔍 Search &amp; Auto-Fill
											</button>
										</div>
										{omdbStatus && (
											<div
												style={{
													marginTop: '0.5rem',
													fontSize: '0.88rem',
													fontWeight: 600,
													color: omdbStatus.startsWith('✅') ? '#059669' : '#d97706',
												}}
											>
												{omdbStatus}
											</div>
										)}
									</div>

									{/* Edit Movie Form */}
									<form onSubmit={handleSaveMovie}>
										<div className="form-grid">
											<div className="form-group">
												<label className="form-label">Movie Title *</label>
												<input
													type="text"
													className="form-input"
													required
													value={editFormData.title || ''}
													onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
												/>
											</div>

											<div className="form-group">
												<label className="form-label">Original Title</label>
												<input
													type="text"
													className="form-input"
													value={editFormData.originalTitle || ''}
													onChange={(e) => setEditFormData({ ...editFormData, originalTitle: e.target.value })}
												/>
											</div>

											<div className="form-group">
												<label className="form-label">Release Year</label>
												<input
													type="number"
													className="form-input"
													placeholder="2026"
													value={editFormData.year || ''}
													onChange={(e) => setEditFormData({ ...editFormData, year: e.target.value })}
												/>
											</div>

											<div className="form-group">
												<label className="form-label">Type</label>
												<select
													className="form-input"
													value={editFormData.type || 'movie'}
													onChange={(e) => setEditFormData({ ...editFormData, type: e.target.value })}
												>
													<option value="movie">Movie</option>
													<option value="series">TV Series</option>
												</select>
											</div>

											<div className="form-group">
												<label className="form-label">Genre(s)</label>
												<input
													type="text"
													className="form-input"
													placeholder="Action, Crime, Drama"
													value={editFormData.genre || ''}
													onChange={(e) => setEditFormData({ ...editFormData, genre: e.target.value })}
												/>
											</div>

											<div className="form-group">
												<label className="form-label">Language</label>
												<input
													type="text"
													className="form-input"
													placeholder="Dual Audio [Hindi + English]"
													value={editFormData.language || ''}
													onChange={(e) => setEditFormData({ ...editFormData, language: e.target.value })}
												/>
											</div>

											<div className="form-group">
												<label className="form-label">Director</label>
												<input
													type="text"
													className="form-input"
													value={editFormData.director || ''}
													onChange={(e) => setEditFormData({ ...editFormData, director: e.target.value })}
												/>
											</div>

											<div className="form-group">
												<label className="form-label">Cast / Actors</label>
												<input
													type="text"
													className="form-input"
													value={editFormData.cast || ''}
													onChange={(e) => setEditFormData({ ...editFormData, cast: e.target.value })}
												/>
											</div>

											<div className="form-group">
												<label className="form-label">IMDb Rating (e.g. 8.5)</label>
												<input
													type="text"
													className="form-input"
													placeholder="8.5"
													value={editFormData.imdbRating || ''}
													onChange={(e) => setEditFormData({ ...editFormData, imdbRating: e.target.value })}
												/>
											</div>

											<div className="form-group">
												<label className="form-label">IMDb Votes Count</label>
												<input
													type="text"
													className="form-input"
													placeholder="1500"
													value={editFormData.imdbVotes || ''}
													onChange={(e) => setEditFormData({ ...editFormData, imdbVotes: e.target.value })}
												/>
											</div>

											<div className="form-group">
												<label className="form-label">IMDb ID (tt1234567)</label>
												<input
													type="text"
													className="form-input"
													placeholder="tt1234567"
													value={editFormData.imdbId || ''}
													onChange={(e) => setEditFormData({ ...editFormData, imdbId: e.target.value })}
												/>
											</div>

											<div className="form-group">
												<label className="form-label">Runtime (e.g. 120 min)</label>
												<input
													type="text"
													className="form-input"
													placeholder="120 min"
													value={editFormData.runtime || ''}
													onChange={(e) => setEditFormData({ ...editFormData, runtime: e.target.value })}
												/>
											</div>

											<div className="form-group full-width">
												<label className="form-label">Poster Image URL</label>
												<input
													type="text"
													className="form-input"
													placeholder="https://..."
													value={editFormData.posterUrl || ''}
													onChange={(e) => setEditFormData({ ...editFormData, posterUrl: e.target.value })}
												/>
											</div>

											<div className="form-group full-width">
												<label className="form-label">Trailer Video URL (MP4 / YouTube / IMDb Embed)</label>
												<input
													type="text"
													className="form-input"
													placeholder="https://..."
													value={editFormData.trailerUrl || ''}
													onChange={(e) => setEditFormData({ ...editFormData, trailerUrl: e.target.value })}
												/>
											</div>

											<div className="form-group full-width">
												<label className="form-label">Description / Plot Overview</label>
												<textarea
													className="form-textarea"
													rows={4}
													value={editFormData.description || ''}
													onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
												/>
											</div>
										</div>

										{saveStatus && (
											<div
												style={{
													marginTop: '1.25rem',
													padding: '0.75rem 1rem',
													borderRadius: '8px',
													background: saveStatus.startsWith('✅') ? '#d1fae5' : '#fee2e2',
													color: saveStatus.startsWith('✅') ? '#047857' : '#dc2626',
													fontWeight: 700,
													fontSize: '0.9rem',
												}}
											>
												{saveStatus}
											</div>
										)}

										<div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.75rem' }}>
											<button type="button" className="admin-btn admin-btn-secondary" onClick={handleCloseEdit}>
												Cancel
											</button>
											<button type="submit" className="admin-btn admin-btn-primary" style={{ padding: '0.7rem 1.5rem', fontSize: '1rem' }}>
												💾 Save Movie Updates
											</button>
										</div>
									</form>
								</div>
							</div>
						)}
					</div>
				)
			) : (
				<>
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

									{/* Official Trailer Video Player */}
									{movie?.trailerUrl && (
										<div className="spec-box" style={{ marginTop: '1.5rem' }}>
											<div className="spec-box-title">
												<span>🎥</span>
												<span>Official IMDb Trailer / Video Preview</span>
											</div>
											<div style={{ padding: '0.75rem 0' }}>
												{movie.trailerUrl.includes('.mp4') ? (
													<video
														src={movie.trailerUrl}
														controls
														playsInline
														preload="metadata"
														style={{ width: '100%', maxHeight: '420px', borderRadius: '8px', background: '#000' }}
													/>
												) : (
													<iframe
														src={movie.trailerUrl}
														title={`${movie.title || 'Movie'} Trailer`}
														style={{ width: '100%', height: '360px', borderRadius: '8px', border: 'none' }}
														allowFullScreen
													/>
												)}
											</div>
										</div>
									)}

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
											This media asset is stored securely within the Telegram Cloud Network. Access validation via our 10-second security
											timer ensures optimal transfer speeds across Cloudflare edge locations while preventing hotlinking.
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
																e.target.src =
																	'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=600&q=80';
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
									CineTech Daily is a premier tech and cinema publication exploring digital film compression, high-bitrate encodings, and
									cloud worker architectures.
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
				</>
			)}

			{/* Footer */}
			<footer className="blog-footer">
				<div style={{ maxWidth: '1240px', margin: '0 auto' }}>
					<p>© 2026 CineTech Daily. All rights reserved. Powered by Cloudflare Workers &amp; Telegram Bot Architecture.</p>
					<p style={{ marginTop: '0.5rem', fontSize: '0.82rem', color: '#64748b' }}>
						Verified Media Index • Edge Content CDN • Admin Controls
					</p>
				</div>
			</footer>

			{showPreviewModal && (
				<div className="modal-overlay modal-open" onClick={cancelPreview} style={{ zIndex: 100000 }}>
					<div className="modal-content" onClick={(e) => e.stopPropagation()}>
						<div className="modal-header">
							<h3 className="modal-title">⚠️ Confirm Propagation to Affected Entries</h3>
							<button className="modal-close" onClick={cancelPreview}>
								✕
							</button>
						</div>
						<div style={{ padding: '1rem', maxHeight: '50vh', overflow: 'auto' }}>
							{previewResult?.preview && previewResult.preview.length > 0 ? (
								<ul style={{ listStyle: 'none', padding: 0 }}>
									{previewResult.preview.map((p) => (
										<li key={p.id} style={{ marginBottom: '0.75rem', padding: '0.5rem', borderRadius: '6px', background: '#f8fafc' }}>
											<div style={{ fontWeight: 700 }}>Record #{p.id}</div>
											<div style={{ marginTop: '0.25rem', fontSize: '0.9rem' }}>
												{Object.keys(p.updates).map((k) => (
													<div key={k}>
														<strong>{k}:</strong> {String(p.updates[k])}
													</div>
												))}
											</div>
										</li>
									))}
								</ul>
							) : (
								<div>No other records would be changed.</div>
							)}
						</div>
						<div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '1rem' }}>
							<button className="admin-btn admin-btn-secondary" onClick={cancelPreview}>
								Cancel
							</button>
							<button className="admin-btn admin-btn-primary" onClick={applyConfirmedSave}>
								Confirm &amp; Apply
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

createRoot(document.getElementById('root')).render(<App />);
