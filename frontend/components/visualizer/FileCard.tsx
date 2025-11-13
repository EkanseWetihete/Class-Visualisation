import React from 'react';
import styles from '../CodeVisualizer.module.css';
import { FileBox } from './types';

interface FileCardProps {
  fileBox: FileBox;
  onMouseDown: (event: React.MouseEvent<SVGGElement>, fileBox: FileBox) => void;
  onContextMenuFile: (event: React.MouseEvent<SVGGElement>, fileBox: FileBox) => void;
  onContextMenuItem: (
    event: React.MouseEvent<SVGGElement>,
    payload: { fileBox: FileBox; itemId: string }
  ) => void;
  selectedFileId?: string;
  selectedItemId?: string;
  highlightedTargets: Set<string>;
}

export const FileCard: React.FC<FileCardProps> = ({
  fileBox,
  onMouseDown,
  onContextMenuFile,
  onContextMenuItem,
  selectedFileId,
  selectedItemId,
  highlightedTargets
}) => {
  const isSelectedFile = selectedFileId === fileBox.id || (selectedItemId && fileBox.items.some(item => item.id === selectedItemId));
  const fileClassName = isSelectedFile ? `${styles.fileBox} ${styles.fileBoxSelected}` : styles.fileBox;

  return (
    <g
      onMouseDown={event => {
        event.stopPropagation();
        onMouseDown(event, fileBox);
      }}
      onContextMenu={event => {
        event.preventDefault();
        event.stopPropagation();
        onContextMenuFile(event, fileBox);
      }}
      style={{ cursor: 'grab' }}
    >
      <rect
        x={fileBox.position.x}
        y={fileBox.position.y}
        width={fileBox.size.width}
        height={fileBox.size.height}
        className={fileClassName}
      />
      <text
        x={fileBox.position.x + fileBox.size.width / 2}
        y={fileBox.position.y + 20}
        className={isSelectedFile ? `${styles.fileTitle} ${styles.fileTitleSelected}` : styles.fileTitle}
        textAnchor="middle"
      >
        {fileBox.displayName}
      </text>

      {fileBox.items.map(item => {
        const itemX = fileBox.position.x + item.position.x;
        const itemY = fileBox.position.y + item.position.y;
        const isItemSelected = selectedItemId === item.id;
        const isHighlightTarget = highlightedTargets.has(item.id);
        const baseClass = item.type === 'class' ? styles.classBox : styles.functionBox;
        const itemClassName = [
          baseClass,
          isItemSelected ? styles.itemSelected : '',
          !isItemSelected && isHighlightTarget ? styles.itemHighlighted : ''
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <g
            key={item.id}
            onContextMenu={event => {
              event.preventDefault();
              event.stopPropagation();
              onContextMenuItem(event, { fileBox, itemId: item.id });
            }}
          >
            <rect
              x={itemX}
              y={itemY}
              width={item.size.width}
              height={item.size.height}
              className={itemClassName}
            />
            <text x={itemX + 10} y={itemY + 22} className={styles.itemName}>
              {item.name}
            </text>
            {item.args.length > 0 && (
              <text x={itemX + 10} y={itemY + 40} className={styles.itemArgs}>
                ({item.args.join(', ')})
              </text>
            )}
            {item.type === 'class' && item.methods && (
              <>
                <line
                  x1={itemX}
                  y1={itemY + 48}
                  x2={itemX + item.size.width}
                  y2={itemY + 48}
                  className={styles.separator}
                />
                {item.methods.map((method, idx) => (
                  <text key={method} x={itemX + 10} y={itemY + 68 + idx * 24} className={styles.methodName}>
                    + {method}()
                  </text>
                ))}
              </>
            )}
          </g>
        );
      })}
    </g>
  );
};
