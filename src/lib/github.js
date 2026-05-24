// GitHub API Integration and Data Mapping
import { COUNTRY_NAMES } from '../store';

const GITHUB_API = 'https://api.github.com/users';

const hashString = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
};

// Function to generate unique procedural mock repos based on username
const generateMockRepos = (username) => {
  const repos = [];
  const seed = hashString(username);
  const count = (seed % 35) + 5; // Between 5 and 40 unique repos
  const MOCK_LANGS = ['JavaScript', 'Python', 'Rust', 'Go', 'TypeScript', 'C++', 'Java', 'Ruby', 'HTML', 'CSS'];
  
  for (let i = 0; i < count; i++) {
    const lang = MOCK_LANGS[(seed + i) % MOCK_LANGS.length];
    const name = `system-${username.toLowerCase()}-${i}`;
    repos.push({
      name,
      size: 1000 + (((seed * i) % 50) * 1000),
      stargazers_count: (seed * (i + 1)) % 5000,
      language: lang,
      description: `[GitHub API Rate Limit Reached] Procedural mock data for ${name}`,
      forks: (seed % 100) + i * 2,
    });
  }
  
  const mockRepos = repos.sort((a, b) => b.stargazers_count - a.stargazers_count);
  mockRepos.isMock = true;
  return mockRepos;
};

const getHeaders = () => {
  const token = localStorage.getItem('GITVERSE_TOKEN') || import.meta.env.VITE_GITHUB_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

  export const fetchUserData = async (username) => {
    // GitHub usernames cannot contain spaces
    if (username.includes(' ')) {
      return { notFound: true, message: 'Invalid username format' };
    }
    
    try {
      const res = await fetch(`${GITHUB_API}/${username}`, { headers: getHeaders() });
      if (res.status === 404) return { notFound: true, message: 'User does not exist on GitHub' };
      if (!res.ok) throw new Error('Rate limit');
      const user = await res.json();
      
      let loc = user.location;
      if (!loc) {
        const USER_OVERRIDES = { 'arp1it': 'India' };
        if (USER_OVERRIDES[username.toLowerCase()]) {
          loc = USER_OVERRIDES[username.toLowerCase()];
        } else {
          const seed = hashString(username);
          loc = COUNTRY_NAMES[seed % COUNTRY_NAMES.length];
        }
      }
      
      return {
        name: user.name || user.login,
        followers: user.followers,
        publicRepos: user.public_repos,
        location: loc,
        avatarUrl: user.avatar_url
      };
    } catch (err) {
      const USER_OVERRIDES = { 'arp1it': 'India', 'torvalds': 'Finland' };
      const seed = hashString(username);
      
      let proceduralCountry = COUNTRY_NAMES[seed % COUNTRY_NAMES.length];
      if (USER_OVERRIDES[username.toLowerCase()]) {
        proceduralCountry = USER_OVERRIDES[username.toLowerCase()];
      }
      
      return {
        name: username,
        followers: (seed % 15000) + 10,
        publicRepos: (seed % 35) + 5,
        location: proceduralCountry,
        avatarUrl: '',
        isRateLimited: true
      };
    }
  };

export const fetchUserRepos = async (username) => {
  try {
    const res = await fetch(`https://api.github.com/users/${username}/repos?per_page=100&sort=pushed&direction=desc`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Repos not found or rate limit');
    let repos = await res.json();
    
    // Filter duplicates and empty repos
    const uniqueRepos = Array.from(new Map(repos.filter(r => r.size > 0).map(r => [r.name, r])).values());
    return uniqueRepos;
  } catch (err) {
    // If rate limited or procedural user, generate unique solar system
    return generateMockRepos(username);
  }
};

export const fetchRepoLanguages = async (username, repo) => {
  try {
    const res = await fetch(`https://api.github.com/repos/${username}/${repo}/languages`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Languages not found');
    const langs = await res.json();
    
    // Calculate percentages strictly
    const total = Object.values(langs).reduce((a, b) => a + b, 0);
    if (total === 0) throw new Error('No language data');
    
    return Object.entries(langs).map(([lang, bytes]) => ({
      language: lang,
      percentage: bytes / total
    }));
  } catch (err) {
    // Deterministic mock languages based on string hash
    const hash = repo.length;
    if (hash % 3 === 0) return [{ language: 'JavaScript', percentage: 0.6 }, { language: 'CSS', percentage: 0.3 }, { language: 'HTML', percentage: 0.1 }];
    if (hash % 2 === 0) return [{ language: 'Python', percentage: 0.8 }, { language: 'C++', percentage: 0.2 }];
    return [{ language: 'TypeScript', percentage: 1.0 }];
  }
};

// Language to Color Mapping System
export const getLanguageColor = (language) => {
  const colors = {
    JavaScript: '#f7df1e', // Glowing yellow
    TypeScript: '#3178c6', // Deep neon blue
    Python: '#00f3ff',     // Cyan energy
    'C++': '#9e9e9e',      // Metallic grey
    Rust: '#ff5722',       // Volcanic orange
    Go: '#00add8',         // Smooth turquoise
    Java: '#f89820',       // Hot red/orange
    HTML: '#e34f26',       // Orange
    CSS: '#1572b6',        // Blue
    Shell: '#4caf50',      // Dark hacker green
    Ruby: '#cc342d',       // Deep red
    PHP: '#4F5D95',        // Soft blue
    Swift: '#F05138',      // Orange red
  };
  return colors[language] || '#ffffff';
};
