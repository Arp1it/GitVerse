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
    if (!locationString) return get().galaxies.find(g => g.name === 'USA');
    
    const locLower = locationString.toLowerCase();

    // Comprehensive city/state/region → country mapping
    const CITY_TO_COUNTRY = {
      // India — unambiguous city names only
      'india': 'India', 'noida': 'India', 'delhi': 'India', 'new delhi': 'India', 'mumbai': 'India',
      'bangalore': 'India', 'bengaluru': 'India', 'hyderabad': 'India', 'pune': 'India',
      'chennai': 'India', 'kolkata': 'India', 'ahmedabad': 'India', 'surat': 'India',
      'jaipur': 'India', 'lucknow': 'India', 'kanpur': 'India', 'nagpur': 'India',
      'indore': 'India', 'bhopal': 'India', 'patna': 'India', 'ludhiana': 'India',
      'agra': 'India', 'kochi': 'India', 'coimbatore': 'India', 'vadodara': 'India',
      'gurgaon': 'India', 'gurugram': 'India', 'faridabad': 'India', 'ghaziabad': 'India',
      'meerut': 'India', 'rajkot': 'India', 'varanasi': 'India', 'amritsar': 'India',
      'ranchi': 'India', 'chandigarh': 'India', 'bhubaneswar': 'India', 'thiruvananthapuram': 'India',
      'mysuru': 'India', 'mysore': 'India', 'visakhapatnam': 'India', 'vizag': 'India',
      'mangaluru': 'India', 'mangalore': 'India', 'dehradun': 'India', 'jammu': 'India',
      'shimla': 'India', 'goa': 'India',
      // NOTE: 'in' removed — ambiguous with Indiana, USA

      // USA — unambiguous names only
      'united states': 'USA', 'usa': 'USA', 'new york': 'USA', 'los angeles': 'USA',
      'chicago': 'USA', 'houston': 'USA', 'phoenix': 'USA', 'philadelphia': 'USA',
      'san antonio': 'USA', 'san diego': 'USA', 'dallas': 'USA', 'san jose': 'USA',
      'austin': 'USA', 'jacksonville': 'USA', 'san francisco': 'USA', 'columbus': 'USA',
      'seattle': 'USA', 'denver': 'USA', 'boston': 'USA',
      'nashville': 'USA', 'portland': 'USA', 'las vegas': 'USA', 'memphis': 'USA',
      'atlanta': 'USA', 'miami': 'USA', 'minneapolis': 'USA', 'new orleans': 'USA',
      'california': 'USA', 'texas': 'USA', 'florida': 'USA', 'illinois': 'USA',
      'new jersey': 'USA', 'ohio': 'USA', 'michigan': 'USA',
      'raleigh': 'USA', 'charlotte': 'USA', 'pittsburgh': 'USA', 'detroit': 'USA',
      'salt lake city': 'USA', 'st. louis': 'USA', 'kansas city': 'USA', 'new york city': 'USA',
      // NOTE: 'us', 'georgia', 'washington', 'ca' removed — ambiguous with country Georgia, Washington DC vs State, Canada/California

      // UK
      'united kingdom': 'UK', 'uk': 'UK', 'england': 'UK', 'scotland': 'UK', 'wales': 'UK',
      'london': 'UK', 'manchester': 'UK', 'birmingham': 'UK', 'leeds': 'UK',
      'glasgow': 'UK', 'sheffield': 'UK', 'bradford': 'UK', 'liverpool': 'UK',
      'edinburgh': 'UK', 'bristol': 'UK', 'cambridge': 'UK', 'oxford': 'UK',
      'cardiff': 'UK', 'belfast': 'UK', 'nottingham': 'UK', 'leicester': 'UK',

      // Germany — unambiguous
      'germany': 'Germany', 'deutschland': 'Germany', 'berlin': 'Germany', 'munich': 'Germany',
      'münchen': 'Germany', 'hamburg': 'Germany', 'cologne': 'Germany', 'köln': 'Germany',
      'frankfurt': 'Germany', 'stuttgart': 'Germany', 'düsseldorf': 'Germany', 'dortmund': 'Germany',
      'essen': 'Germany', 'bremen': 'Germany', 'hannover': 'Germany', 'nuremberg': 'Germany',
      'nürnberg': 'Germany', 'leipzig': 'Germany', 'dresden': 'Germany',
      // NOTE: 'de' removed — too short, could be anything

      // France
      'france': 'France', 'paris': 'France', 'lyon': 'France', 'marseille': 'France',
      'toulouse': 'France', 'nice': 'France', 'nantes': 'France', 'strasbourg': 'France',
      'montpellier': 'France', 'bordeaux': 'France', 'lille': 'France', 'rennes': 'France',
      'fr': 'France',

      // Canada — unambiguous cities only
      'canada': 'Canada', 'toronto': 'Canada', 'montreal': 'Canada', 'vancouver': 'Canada',
      'calgary': 'Canada', 'edmonton': 'Canada', 'ottawa': 'Canada', 'winnipeg': 'Canada',
      'quebec': 'Canada', 'kitchener': 'Canada',
      // NOTE: 'ca', 'hamilton' removed — ambiguous with California/New Zealand

      // China
      'china': 'China', 'beijing': 'China', 'shanghai': 'China', 'shenzhen': 'China',
      'guangzhou': 'China', 'chengdu': 'China', 'hangzhou': 'China', 'wuhan': 'China',
      'xi\'an': 'China', 'suzhou': 'China', 'tianjin': 'China', 'nanjing': 'China',
      'cn': 'China',

      // Japan
      'japan': 'Japan', 'tokyo': 'Japan', 'osaka': 'Japan', 'kyoto': 'Japan',
      'yokohama': 'Japan', 'nagoya': 'Japan', 'sapporo': 'Japan', 'fukuoka': 'Japan',
      'kobe': 'Japan', 'kawasaki': 'Japan', 'hiroshima': 'Japan', 'jp': 'Japan',

      // Brazil
      'brazil': 'Brazil', 'brasil': 'Brazil', 'são paulo': 'Brazil', 'sao paulo': 'Brazil',
      'rio de janeiro': 'Brazil', 'rio': 'Brazil', 'brasilia': 'Brazil', 'salvador': 'Brazil',
      'fortaleza': 'Brazil', 'belo horizonte': 'Brazil', 'manaus': 'Brazil', 'curitiba': 'Brazil',
      'br': 'Brazil',

      // Russia
      'russia': 'Russia', 'moscow': 'Russia', 'saint petersburg': 'Russia', 'novosibirsk': 'Russia',
      'yekaterinburg': 'Russia', 'nizhny novgorod': 'Russia', 'kazan': 'Russia', 'ru': 'Russia',

      // Australia
      'australia': 'Australia', 'sydney': 'Australia', 'melbourne': 'Australia', 'brisbane': 'Australia',
      'perth': 'Australia', 'adelaide': 'Australia', 'canberra': 'Australia', 'au': 'Australia',

      // Netherlands
      'netherlands': 'Netherlands', 'holland': 'Netherlands', 'amsterdam': 'Netherlands',
      'rotterdam': 'Netherlands', 'the hague': 'Netherlands', 'utrecht': 'Netherlands', 'nl': 'Netherlands',

      // Spain
      'spain': 'Spain', 'madrid': 'Spain', 'barcelona': 'Spain', 'valencia': 'Spain',
      'seville': 'Spain', 'zaragoza': 'Spain', 'bilbao': 'Spain', 'es': 'Spain',

      // Italy
      'italy': 'Italy', 'rome': 'Italy', 'milan': 'Italy', 'naples': 'Italy',
      'turin': 'Italy', 'florence': 'Italy', 'bologna': 'Italy', 'venice': 'Italy', 'it': 'Italy',

      // South Korea
      'south korea': 'South Korea', 'korea': 'South Korea', 'seoul': 'South Korea',
      'busan': 'South Korea', 'incheon': 'South Korea', 'daegu': 'South Korea', 'kr': 'South Korea',

      // Ukraine
      'ukraine': 'Ukraine', 'kyiv': 'Ukraine', 'kharkiv': 'Ukraine', 'odessa': 'Ukraine', 'ua': 'Ukraine',

      // Pakistan
      'pakistan': 'Pakistan', 'karachi': 'Pakistan', 'lahore': 'Pakistan', 'islamabad': 'Pakistan',
      'rawalpindi': 'Pakistan', 'faisalabad': 'Pakistan', 'pk': 'Pakistan',

      // Bangladesh
      'bangladesh': 'Bangladesh', 'dhaka': 'Bangladesh', 'chittagong': 'Bangladesh', 'bd': 'Bangladesh',

      // Nigeria
      'nigeria': 'Nigeria', 'lagos': 'Nigeria', 'abuja': 'Nigeria', 'kano': 'Nigeria', 'ng': 'Nigeria',

      // Indonesia
      'indonesia': 'Indonesia', 'jakarta': 'Indonesia', 'surabaya': 'Indonesia', 'bandung': 'Indonesia', 'id': 'Indonesia',

      // Turkey
      'turkey': 'Turkey', 'türkiye': 'Turkey', 'istanbul': 'Turkey', 'ankara': 'Turkey', 'izmir': 'Turkey', 'tr': 'Turkey',

      // Sweden
      'sweden': 'Sweden', 'stockholm': 'Sweden', 'gothenburg': 'Sweden', 'malmö': 'Sweden', 'se': 'Sweden',

      // Norway — unambiguous
      'norway': 'Norway', 'oslo': 'Norway', 'bergen': 'Norway',
      // NOTE: 'no' removed — too short/ambiguous

      // Finland
      'finland': 'Finland', 'helsinki': 'Finland', 'tampere': 'Finland', 'fi': 'Finland',

      // Denmark
      'denmark': 'Denmark', 'copenhagen': 'Denmark', 'dk': 'Denmark',

      // Poland
      'poland': 'Poland', 'warsaw': 'Poland', 'krakow': 'Poland', 'wroclaw': 'Poland', 'pl': 'Poland',

      // Portugal
      'portugal': 'Portugal', 'lisbon': 'Portugal', 'porto': 'Portugal', 'pt': 'Portugal',

      // Switzerland
      'switzerland': 'Switzerland', 'zurich': 'Switzerland', 'geneva': 'Switzerland', 'bern': 'Switzerland', 'ch': 'Switzerland',

      // Argentina
      'argentina': 'Argentina', 'buenos aires': 'Argentina', 'córdoba': 'Argentina', 'ar': 'Argentina',

      // Mexico
      'mexico': 'Mexico', 'méxico': 'Mexico', 'mexico city': 'Mexico', 'guadalajara': 'Mexico', 'monterrey': 'Mexico', 'mx': 'Mexico',

      // Singapore
      'singapore': 'Singapore', 'sg': 'Singapore',

      // Israel
      'israel': 'Israel', 'tel aviv': 'Israel', 'jerusalem': 'Israel', 'il': 'Israel',

      // Iran
      'iran': 'Iran', 'tehran': 'Iran', 'ir': 'Iran',

      // Egypt
      'egypt': 'Egypt', 'cairo': 'Egypt', 'eg': 'Egypt',

      // South Africa
      'south africa': 'South Africa', 'johannesburg': 'South Africa', 'cape town': 'South Africa', 'durban': 'South Africa', 'za': 'South Africa',

      // United Arab Emirates
      'united arab emirates': 'United Arab Emirates', 'uae': 'United Arab Emirates',
      'dubai': 'United Arab Emirates', 'abu dhabi': 'United Arab Emirates', 'ae': 'United Arab Emirates',
    };

    // 1. Direct keyword match (most reliable)
    for (const [keyword, country] of Object.entries(CITY_TO_COUNTRY)) {
      if (locLower.includes(keyword)) {
        const galaxy = get().galaxies.find(g => g.name.toLowerCase() === country.toLowerCase());
        if (galaxy) return galaxy;
      }
    }

    // 2. Try the last part after comma (e.g. "Noida, UP, India" → "India")
    const parts = locationString.split(',').map(s => s.trim()).reverse();
    for (const part of parts) {
      const galaxy = get().galaxies.find(g => g.name.toLowerCase() === part.toLowerCase());
      if (galaxy) return galaxy;
    }

    // 3. Fallback: create a new galaxy for truly unknown locations
    const r = 12000 + (Math.random() * 5000);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(1 - 2 * Math.random());
    const newPos = [
      r * Math.cos(theta) * Math.sin(phi),
      r * Math.sin(theta) * Math.sin(phi),
      r * Math.cos(phi)
    ];
    const newGalaxy = {
      name: locationString.split(',').pop().trim(),
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
