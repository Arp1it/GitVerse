import { create } from 'zustand';

export const COUNTRY_NAMES = [
  "USA", "India", "China", "UK", "Germany", "Japan", "Brazil", "Russia", "France", "Canada",
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia", "Cameroon", "Central African Republic", "Chad", "Chile", "Colombia", "Comoros", "Congo", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czechia", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Fiji", "Finland", "Gabon", "Gambia", "Georgia", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana", "Haiti", "Honduras", "Hungary", "Iceland", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Jamaica", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway", "Oman", "Pakistan", "Palau", "Palestine", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Qatar", "Romania", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria", "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "Uruguay", "Uzbekistan", "Vanuatu", "Vatican City", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe"
];

// Distribute ALL countries perfectly across the 3D Universe using Fibonacci Sphere
const INITIAL_GALAXIES = COUNTRY_NAMES.map((name, i) => {
  const hue = (i * 137.508) % 360; 
  const cIn = `hsl(${hue}, 80%, 60%)`;
  const cOut = `hsl(${hue}, 100%, 30%)`;

  let size = 1.0;
  if (["USA", "India", "China"].includes(name)) size = 2.5;
  else if (["UK", "Germany", "Japan", "Brazil", "Russia"].includes(name)) size = 1.8;
  else size = 0.5 + (Math.random() * 0.8);

  const phi = Math.acos(1 - 2 * (i + 0.5) / COUNTRY_NAMES.length);
  const theta = Math.PI * (1 + Math.sqrt(5)) * (i + 0.5);
  const radius = 15000; 

  const x = radius * Math.cos(theta) * Math.sin(phi);
  const y = radius * Math.sin(theta) * Math.sin(phi);
  const z = radius * Math.cos(phi);

  return { name, pos: [x, y, z], cIn, cOut, size };
});

export const useStore = create((set, get) => ({
  galaxies: INITIAL_GALAXIES,
  githubToken: localStorage.getItem('GITVERSE_TOKEN') || '',

  setGithubToken: (token) => {
    localStorage.setItem('GITVERSE_TOKEN', token);
    set({ githubToken: token });
  },
  viewLevel: 'UNIVERSE', // 'UNIVERSE' | 'GALAXY' | 'SYSTEM' | 'PLANET'
  cameraTarget: [0, 0, 0],
  cameraPosition: [0, 4000, 8000],
  minDistance: 100, 
  
  selectedGalaxy: null,
  selectedUser: null,
  selectedPlanet: null,
  systemPosition: [0, 0, 0],

  // DYNAMIC GALAXY DETECTION
  ensureGalaxyExists: (locationString) => {
    if (!locationString) return get().galaxies.find(g => g.name === 'USA'); // Fallback default
    
    let locName = locationString.toLowerCase();
    
    // Smart Country Dictionary Mapper
    const COUNTRY_MAP = {
      'usa': ['new york', 'san francisco', 'california', 'seattle', 'boston', 'texas', 'chicago', 'united states', 'us'],
      'india': ['delhi', 'bangalore', 'mumbai', 'hyderabad', 'pune', 'chennai', 'india'],
      'japan': ['tokyo', 'osaka', 'kyoto', 'japan', 'jp'],
      'uk': ['london', 'manchester', 'united kingdom', 'england', 'scotland'],
      'germany': ['berlin', 'munich', 'hamburg', 'germany', 'de'],
      'france': ['paris', 'lyon', 'france', 'fr'],
      'canada': ['toronto', 'vancouver', 'montreal', 'canada', 'ca'],
      'brazil': ['sao paulo', 'rio', 'brazil', 'br'],
      'china': ['beijing', 'shanghai', 'shenzhen', 'china', 'cn'],
      'russia': ['moscow', 'saint petersburg', 'russia', 'ru']
    };

    let resolvedCountry = locationString.split(',').pop().trim();
    
    for (const [country, keywords] of Object.entries(COUNTRY_MAP)) {
      if (keywords.some(k => locName.includes(k))) {
        resolvedCountry = country;
        break;
      }
    }

    const existing = get().galaxies.find(g => g.name.toLowerCase() === resolvedCountry.toLowerCase());
    if (existing) return existing;

    // Create random visually distinct galaxy for new unmapped countries
    const r = 12000 + (Math.random() * 5000);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(1 - 2 * Math.random());
    const newPos = [
      r * Math.cos(theta) * Math.sin(phi),
      r * Math.sin(theta) * Math.sin(phi),
      r * Math.cos(phi)
    ];

    const newGalaxy = {
      name: locName,
      cIn: '#' + Math.floor(Math.random()*16777215).toString(16),
      cOut: '#' + Math.floor(Math.random()*16777215).toString(16),
      pos: newPos
    };

    set({ galaxies: [...get().galaxies, newGalaxy] });
    return newGalaxy;
  },

  zoomToUniverse: () => set({ 
    viewLevel: 'UNIVERSE', 
    cameraTarget: [0, 0, 0], 
    cameraPosition: [0, 4000, 8000],
    minDistance: 500,
    selectedGalaxy: null, 
    selectedUser: null, 
    selectedPlanet: null 
  }),
  
  zoomToGalaxy: (name, pos) => set({ 
    viewLevel: 'GALAXY', 
    cameraTarget: pos, 
    cameraPosition: [pos[0], pos[1] + 500, pos[2] + 1000], 
    minDistance: 100,
    selectedGalaxy: name, 
    selectedUser: null, 
    selectedPlanet: null 
  }),
  
  zoomToSystem: (username, pos, sunRadius = 20) => set({ 
    viewLevel: 'SYSTEM', 
    cameraTarget: pos, 
    systemPosition: pos,
    cameraPosition: [pos[0], pos[1] + Math.max(100, sunRadius * 3), pos[2] + Math.max(200, sunRadius * 4)], 
    minDistance: sunRadius + 5, 
    selectedUser: username, 
    selectedPlanet: null 
  }),
  
  zoomToPlanet: (repoName, globalPos, planetRadius = 5) => set({ 
    viewLevel: 'PLANET', 
    cameraTarget: globalPos, 
    cameraPosition: [globalPos[0] + planetRadius * 3, globalPos[1] + planetRadius * 2, globalPos[2] + planetRadius * 4], 
    minDistance: planetRadius + 2, 
    selectedPlanet: repoName 
  })
}));
