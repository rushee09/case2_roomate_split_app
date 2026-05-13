from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # SQLite path relative to backend/ folder
    database_url: str = "sqlite:///../prisma/dev.db"

    # SMTP for invite emails
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_pass: str = ""

    app_url: str = "http://localhost:3000"
    app_name: str = "Pocket"

    class Config:
        env_file = "../.env"
        extra = "ignore"

    # Map .env variable names (uppercase) to these field names
    @classmethod
    def _env_file_settings(cls, init_settings, env_settings, dotenv_settings):
        return super()._env_file_settings(init_settings, env_settings, dotenv_settings)


settings = Settings(
    _env_file="../.env",
)
