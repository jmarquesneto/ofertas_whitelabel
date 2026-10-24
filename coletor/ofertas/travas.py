"""Travas compartilhadas entre o ciclo, o servidor e o login do ML."""
import threading

# Um Chrome por vez no perfil do ML (ciclo, conversor, busca e login dividem o mesmo perfil)
CHROME_LOCK = threading.Lock()
CICLO_LOCK = threading.Lock()
