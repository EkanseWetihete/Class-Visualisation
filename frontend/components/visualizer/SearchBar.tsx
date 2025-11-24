import React from 'react';
import styles from '../CodeVisualizer.module.css';

export interface SearchResult {
  id: string;
  label: string;
  detail: string;
  type: 'file' | 'class' | 'function';
}

interface SearchBarProps {
  query: string;
  onQueryChange: (value: string) => void;
  results: SearchResult[];
  onSelect: (resultId: string) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({ query, onQueryChange, results, onSelect }) => {
  const trimmed = query.trim();
  return (
    <div className={styles.searchBar}>
      <input
        type="search"
        value={query}
        onChange={event => onQueryChange(event.target.value)}
        placeholder="Search files or functions"
        className={styles.searchInput}
      />
      {trimmed.length > 0 && (
        <div className={styles.searchResults}>
          {results.length === 0 && <div className={styles.searchNoResults}>No matches</div>}
          {results.map(result => (
            <button key={result.id} className={styles.searchResultButton} onClick={() => onSelect(result.id)}>
              <span className={styles.searchResultLabel}>{result.label}</span>
              <span className={styles.searchResultMeta}>
                <span className={styles.searchResultType}>{result.type}</span>
                <span className={styles.searchResultDetail}>{result.detail}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
