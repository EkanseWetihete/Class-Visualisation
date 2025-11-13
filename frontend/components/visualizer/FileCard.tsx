import React from 'react';
import styles from '../CodeVisualizer.module.css';
import { FileBox } from './types';

interface FileCardProps {
  fileBox: FileBox;
  onMouseDown: (event: React.MouseEvent<SVGGElement>, fileBox: FileBox) => void;
}

export const FileCard: React.FC<FileCardProps> = ({ fileBox, onMouseDown }) => {
  return (
    <g onMouseDown={event => onMouseDown(event, fileBox)} style={{ cursor: 'grab' }}>
      <rect
        x={fileBox.position.x}
        y={fileBox.position.y}
        width={fileBox.size.width}
        height={fileBox.size.height}
        className={styles.fileBox}
      />
      <text
        x={fileBox.position.x + fileBox.size.width / 2}
        y={fileBox.position.y + 20}
        className={styles.fileTitle}
        textAnchor="middle"
      >
        {fileBox.displayName}
      </text>

      {fileBox.items.map(item => {
        const itemX = fileBox.position.x + item.position.x;
        const itemY = fileBox.position.y + item.position.y;

        return (
          <g key={item.id}>
            <rect
              x={itemX}
              y={itemY}
              width={item.size.width}
              height={item.size.height}
              className={item.type === 'class' ? styles.classBox : styles.functionBox}
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
