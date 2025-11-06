import { useState, useEffect, useRef } from 'react';

export default function ChannelOrRoleSelector({ type, label, guildId, value, onChange }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

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

  const buildFetchOptions = (signal) => {
    const fetchOptions = { credentials: 'include', cache: 'no-store' };
    if (signal) fetchOptions.signal = signal;
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.startsWith('chirp_session=')) {
        const chirpSessionCookie = cookie.substring('chirp_session='.length);
        if (chirpSessionCookie) {
          fetchOptions.headers = { 'X-Chirp-Session': chirpSessionCookie };
        }
        break;
      }
    }
    return fetchOptions;
  };

  useEffect(() => {
    if (selectedItem && searchResults.every((item) => item.id !== selectedItem.id)) {
      setSearchResults((prev) => [selectedItem, ...prev].slice(0, 25));
    }
  }, [selectedItem, searchResults]);

  useEffect(() => {
    if (!value) {
      setSelectedItem(null);
      return;
    }
    if (!guildId) return;
    const controller = new AbortController();
    const fetchSelected = async () => {
      try {
        const url = `/.netlify/functions/guild-insights?guild_id=${encodeURIComponent(guildId)}&search_type=${encodeURIComponent(type)}&search_query=${encodeURIComponent(value)}`;
        const response = await fetch(url, buildFetchOptions(controller.signal));
        const json = await response.json();
        const items = json.searchResults?.items || [];
        const match = items.find((item) => item.id === value) || null;
        if (match) {
          setSelectedItem(match);
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error(`Error fetching selected ${type}:`, error);
        }
      }
    };
    fetchSelected();
    return () => controller.abort();
  }, [value, guildId, type]);

  const handleSearch = async (query) => {
    if (!guildId) {
      setSearchResults([]);
      return;
    }
    try {
      const url = `/.netlify/functions/guild-insights?guild_id=${encodeURIComponent(guildId)}&search_type=${encodeURIComponent(type)}&search_query=${encodeURIComponent(query || '')}`;
      const response = await fetch(url, buildFetchOptions());
      const json = await response.json();
      let items = json.searchResults?.items || [];
      if (selectedItem && items.every((item) => item.id !== selectedItem.id)) {
        items = [selectedItem, ...items].slice(0, 25);
      }
      setSearchResults(items);
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
    setSelectedItem(item);
    setSearchQuery('');
    setIsOpen(false);
  };

  const inputValue = searchQuery || (selectedItem ? selectedItem.name : '');

  return (
    <div className="select-wrapper" ref={wrapperRef} style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label>{label}</label>
        <input
          type="text"
          className="input input--ghost"
          placeholder={`Search for a ${type}...`}
          value={inputValue}
          onChange={handleChange}
          onFocus={() => {
            setIsOpen(true);
            if (searchResults.length === 0) {
              handleSearch('');
            }
          }}
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
