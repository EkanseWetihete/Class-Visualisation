"""
Database abstraction layer for the complex system.
"""

from typing import Dict, List, Any, Optional, TypeVar, Generic
from abc import ABC, abstractmethod
import sqlite3
import json
from datetime import datetime
from utils.logger import Logger
from utils.config_manager import ConfigManager

T = TypeVar('T')

class DatabaseConnection:
    """Database connection manager."""

    def __init__(self, db_path: str = "data/complex_system.db"):
        self.db_path = db_path
        self.connection = None
        self.logger = Logger("Database")

    def connect(self):
        """Establish database connection."""
        try:
            self.connection = sqlite3.connect(self.db_path)
            self.connection.row_factory = sqlite3.Row
            self.logger.info(f"Connected to database: {self.db_path}")
        except Exception as e:
            self.logger.error(f"Failed to connect to database: {str(e)}")
            raise

    def disconnect(self):
        """Close database connection."""
        if self.connection:
            self.connection.close()
            self.connection = None
            self.logger.info("Database connection closed")

    def execute(self, query: str, params: tuple = ()) -> sqlite3.Cursor:
        """Execute a database query."""
        if not self.connection:
            raise Exception("No database connection")

        try:
            cursor = self.connection.cursor()
            cursor.execute(query, params)
            self.connection.commit()
            return cursor
        except Exception as e:
            self.logger.error(f"Query execution failed: {str(e)}")
            self.connection.rollback()
            raise

    def fetch_one(self, query: str, params: tuple = ()) -> Optional[sqlite3.Row]:
        """Fetch a single row."""
        cursor = self.execute(query, params)
        return cursor.fetchone()

    def fetch_all(self, query: str, params: tuple = ()) -> List[sqlite3.Row]:
        """Fetch all rows."""
        cursor = self.execute(query, params)
        return cursor.fetchall()

class BaseRepository(Generic[T], ABC):
    """Base repository class for data access."""

    def __init__(self, db_connection: DatabaseConnection):
        self.db = db_connection
        self.logger = Logger(f"{self.__class__.__name__}")

    @abstractmethod
    def table_name(self) -> str:
        """Return the table name for this repository."""
        pass

    @abstractmethod
    def to_dict(self, entity: T) -> Dict[str, Any]:
        """Convert entity to dictionary."""
        pass

    @abstractmethod
    def from_dict(self, data: Dict[str, Any]) -> T:
        """Create entity from dictionary."""
        pass

    def find_by_id(self, id: int) -> Optional[T]:
        """Find entity by ID."""
        try:
            query = f"SELECT * FROM {self.table_name()} WHERE id = ?"
            row = self.db.fetch_one(query, (id,))

            if row:
                return self.from_dict(dict(row))
            return None
        except Exception as e:
            self.logger.error(f"Failed to find entity by ID: {str(e)}")
            return None

    def find_all(self, limit: int = 100, offset: int = 0) -> List[T]:
        """Find all entities with pagination."""
        try:
            query = f"SELECT * FROM {self.table_name()} LIMIT ? OFFSET ?"
            rows = self.db.fetch_all(query, (limit, offset))

            return [self.from_dict(dict(row)) for row in rows]
        except Exception as e:
            self.logger.error(f"Failed to find all entities: {str(e)}")
            return []

    def save(self, entity: T) -> T:
        """Save entity to database."""
        try:
            data = self.to_dict(entity)
            data['updated_at'] = datetime.now().isoformat()

            if hasattr(entity, 'id') and entity.id:
                # Update existing
                return self._update(entity.id, data)
            else:
                # Create new
                return self._create(data)
        except Exception as e:
            self.logger.error(f"Failed to save entity: {str(e)}")
            raise

    def _create(self, data: Dict[str, Any]) -> T:
        """Create new entity."""
        columns = ', '.join(data.keys())
        placeholders = ', '.join(['?' for _ in data])
        values = tuple(data.values())

        query = f"INSERT INTO {self.table_name()} ({columns}) VALUES ({placeholders})"
        cursor = self.db.execute(query, values)

        # Get the created entity
        created_id = cursor.lastrowid
        return self.find_by_id(created_id)

    def _update(self, id: int, data: Dict[str, Any]) -> T:
        """Update existing entity."""
        set_clause = ', '.join([f"{k} = ?" for k in data.keys() if k != 'id'])
        values = tuple([v for k, v in data.items() if k != 'id'])
        values += (id,)

        query = f"UPDATE {self.table_name()} SET {set_clause} WHERE id = ?"
        self.db.execute(query, values)

        return self.find_by_id(id)

    def delete(self, id: int) -> bool:
        """Delete entity by ID."""
        try:
            query = f"DELETE FROM {self.table_name()} WHERE id = ?"
            self.db.execute(query, (id,))
            self.logger.info(f"Deleted entity {id} from {self.table_name()}")
            return True
        except Exception as e:
            self.logger.error(f"Failed to delete entity: {str(e)}")
            return False

class UserRepository(BaseRepository):
    """Repository for User entities."""

    def table_name(self) -> str:
        return "users"

    def to_dict(self, user) -> Dict[str, Any]:
        """Convert User to dictionary."""
        return {
            'id': user.id,
            'name': user.name,
            'email': user.email,
            'raw_data': json.dumps(user.raw_data),
            'is_active': user.is_active,
            'role': user.role,
            'preferences': json.dumps(user.preferences),
            'last_login': user.last_login.isoformat() if user.last_login else None,
            'created_at': user.created_at.isoformat(),
            'updated_at': user.updated_at.isoformat()
        }

    def from_dict(self, data: Dict[str, Any]):
        """Create User from dictionary."""
        from models.user import User

        user = User(
            id=data['id'],
            name=data['name'],
            email=data['email'],
            raw_data=json.loads(data['raw_data']) if data['raw_data'] else {}
        )
        user.is_active = data['is_active']
        user.role = data['role']
        user.preferences = json.loads(data['preferences']) if data['preferences'] else {}
        user.last_login = datetime.fromisoformat(data['last_login']) if data['last_login'] else None
        user.created_at = datetime.fromisoformat(data['created_at'])
        user.updated_at = datetime.fromisoformat(data['updated_at'])

        return user

    def find_by_email(self, email: str) -> Optional[Any]:
        """Find user by email."""
        try:
            query = f"SELECT * FROM {self.table_name()} WHERE email = ?"
            row = self.db.fetch_one(query, (email,))

            if row:
                return self.from_dict(dict(row))
            return None
        except Exception as e:
            self.logger.error(f"Failed to find user by email: {str(e)}")
            return None

class ReportRepository(BaseRepository):
    """Repository for Report entities."""

    def table_name(self) -> str:
        return "reports"

    def to_dict(self, report) -> Dict[str, Any]:
        """Convert Report to dictionary."""
        return {
            'id': report.id,
            'title': report.title,
            'user_id': report.user.id if report.user else None,
            'data': json.dumps(report.data),
            'status': report.status,
            'file_path': report.file_path,
            'created_at': report.created_at.isoformat(),
            'generated_at': report.generated_at.isoformat() if report.generated_at else None
        }

    def from_dict(self, data: Dict[str, Any]):
        """Create Report from dictionary."""
        from models.report import Report
        from models.user import User

        # Note: In a real implementation, you'd load the user separately
        user = None
        if data['user_id']:
            # This would need a user repository instance
            pass

        report = Report(
            id=data['id'],
            title=data['title'],
            user=user,
            data=json.loads(data['data']) if data['data'] else {}
        )
        report.status = data['status']
        report.file_path = data['file_path']
        report.created_at = datetime.fromisoformat(data['created_at'])
        report.generated_at = datetime.fromisoformat(data['generated_at']) if data['generated_at'] else None

        return report

class DatabaseInitializer:
    """Database schema initializer."""

    def __init__(self, db_connection: DatabaseConnection):
        self.db = db_connection
        self.logger = Logger("DatabaseInitializer")

    def initialize_schema(self):
        """Initialize database schema."""
        self.logger.info("Initializing database schema")

        # Create users table
        self.db.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                raw_data TEXT,
                is_active BOOLEAN DEFAULT 1,
                role TEXT DEFAULT 'user',
                preferences TEXT,
                last_login TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        ''')

        # Create reports table
        self.db.execute('''
            CREATE TABLE IF NOT EXISTS reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                user_id INTEGER,
                data TEXT,
                status TEXT DEFAULT 'pending',
                file_path TEXT,
                created_at TEXT NOT NULL,
                generated_at TEXT,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')

        # Create indexes
        self.db.execute('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)')
        self.db.execute('CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id)')
        self.db.execute('CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status)')

        self.logger.info("Database schema initialized successfully")

    def seed_sample_data(self):
        """Seed database with sample data."""
        from data.sample_data import SAMPLE_USERS

        user_repo = UserRepository(self.db)

        for user_data in SAMPLE_USERS:
            try:
                # Check if user already exists
                existing = user_repo.find_by_email(user_data['email'])
                if not existing:
                    from models.user import User
                    user = User(**user_data)
                    user_repo.save(user)
                    self.logger.info(f"Seeded user: {user.email}")
            except Exception as e:
                self.logger.error(f"Failed to seed user {user_data['email']}: {str(e)}")

        self.logger.info("Sample data seeding completed")