import logging
import os
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Index, Integer, String, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker


logger = logging.getLogger(__name__)

Base = declarative_base()

class EventLog(Base):
    __tablename__ = "event_logs"
    __table_args__ = (Index("ix_event_logs_timestamp", "timestamp"),)
    
    id = Column(Integer, primary_key=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    risk_level = Column(String, nullable=False)
    count = Column(Integer, nullable=False)
    message = Column(String, nullable=False)

class DBService:
    def __init__(self, db_path: str = "data/app.db"):
        # Ensure directory exists
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        
        self.engine = create_engine(
            f"sqlite:///{db_path}",
            connect_args={"check_same_thread": False, "timeout": 10},
        )
        Base.metadata.create_all(self.engine)
        self._ensure_timestamp_index()
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)

    def _ensure_timestamp_index(self) -> None:
        with self.engine.begin() as connection:
            connection.exec_driver_sql(
                "CREATE INDEX IF NOT EXISTS ix_event_logs_timestamp "
                "ON event_logs (timestamp)"
            )
            connection.exec_driver_sql("DROP INDEX IF EXISTS ix_event_logs_id")

    def log_event(self, risk_level: str, count: int, message: str) -> None:
        session = self.SessionLocal()
        try:
            event = EventLog(
                risk_level=risk_level,
                count=count,
                message=message,
                timestamp=datetime.now(timezone.utc)
            )
            session.add(event)
            session.commit()
        except Exception:
            session.rollback()
            logger.exception("Error logging event to the database")
        finally:
            session.close()

    def get_recent_logs(self, limit: int = 50) -> list[EventLog]:
        limit = max(1, min(limit, 500))
        session = self.SessionLocal()
        try:
            return session.query(EventLog).order_by(EventLog.timestamp.desc()).limit(limit).all()
        finally:
            session.close()

    def dispose(self) -> None:
        self.engine.dispose()
