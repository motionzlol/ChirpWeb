import { useState, useEffect, useRef } from 'react';

export default function ChannelOrRoleSelector({ type, label, guildId, value, onChange }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  const selectedItem = searchResults.find(item => item.id === value);
  const displayValue = selectedItem ? selectedItem.name : '';

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSearch = async (query) => {
    if (!query || query.length === 0 || !guildId) {
      setSearchResults([]);
      return;
    }
    try {
      const url = `/.netlify/functions/guild-insights?guild_id=${encodeURIComponent(guildId)}&search_type=${encodeURIComponent(type)}&search_query=${encodeURIComponent(query)}`;
      const fetchOptions = { credentials: 'include', cache: 'no-store' };
      console.log('Fetching search results with URL:', url, 'and options:', fetchOptions);
      const response = await fetch(url, fetchOptions);
      const json = await response.json();
      setSearchResults(json.searchResults?.items || []);
    } catch (error) {
      console.error(`Error searching ${type}s:`, error);
      setSearchResults([]);
    }
  };

  const handleChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    setIsOpen(true);
    handleSearch(query);
  };

  const handleSelect = (item) => {
    onChange(item.id);
    setSearchQuery(item.name);
    setIsOpen(false);
  };

  return (
    <div className="select-wrapper" ref={wrapperRef} style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label>{label}</label>
        <input
          type="text"
          className="input input--ghost"
          placeholder={`Search for a ${type}...`}
          value={searchQuery || displayValue}
          onChange={handleChange}
          onFocus={() => setIsOpen(true)}
        />
      </div>
      {isOpen && searchResults.length > 0 && (
        <ul className="select-dropdown glass">
          {searchResults.map((item) => (
            <li key={item.id} onClick={() => handleSelect(item)}>
              {item.name}
            </li>
          ))}
        </ul>
      )}
      {isOpen && searchQuery && searchResults.length === 0 && (
        <div className="select-dropdown glass muted">No results found.</div>
      )}
    </div>
  );
}
