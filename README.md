# Spotify to YouTube Integration

Bu proje, Spotify çalma listenizdeki şarkıları alıp, YouTube'daki bir oynatma listesine ekleyen bir Python botudur.

## Gereksinimler

- Python 3.7 veya üzeri
- `spotipy` kütüphanesi
- `google-auth`, `google-auth-oauthlib`, `google-auth-httplib2`, `google-api-python-client` kütüphaneleri
- `python-dotenv` kütüphanesi

## Kurulum

```bash


1. Gerekli Python Kütüphanelerini Yükleyin
Gerekli Kütüphaneleri yüklemek için aşağıdaki komutları terminalde çalıştırın:
pip install spotipy google-auth google-auth-oauthlib google-auth-httplib2 google-api-python-client python-dotenv


2. Ortam Değişkenlerini Ayarlayın
Proje kök dizininde bir .env dosyası oluşturun ve aşağıdaki bilgileri ekleyin:

makefile
Kodu kopyala
SPOTIPY_CLIENT_ID=your_spotify_client_id
SPOTIPY_CLIENT_SECRET=your_spotify_client_secret
SPOTIPY_REDIRECT_URI=http://localhost:8888/callback/
YOUTUBE_CLIENT_SECRET_PATH=client_secret.json
YOUTUBE_PLAYLIST_ID=your_youtube_playlist_id


3. Gerekli API Anahtarlarını Alın
Spotify API Anahtarları
Spotify Developer Dashboard adresine gidin ve bir Spotify geliştirici hesabı oluşturun veya mevcut hesabınızla giriş yapın.
Create an App butonuna tıklayın ve uygulama adını ve açıklamasını girin.
Uygulamanız oluşturulduktan sonra, Client ID ve Client Secret değerlerini kopyalayın ve .env dosyasına yapıştırın.
Redirect URI olarak http://localhost:8888/callback/ adresini ayarlayın ve kaydedin.
YouTube API Anahtarları
Google Cloud Console adresine gidin ve bir proje oluşturun veya mevcut bir projeyi seçin.
Sol menüden APIs & Services > Credentials bölümüne gidin.
Create Credentials butonuna tıklayın ve OAuth client ID seçeneğini seçin.
OAuth istemci kimliği oluştururken, "Desktop app" seçeneğini seçin.
Oluşturulan client_secret.json dosyasını indirin ve proje kök dizinine yerleştirin.
YouTube Data API v3'ü etkinleştirin:
Sol menüden Library'e gidin.
YouTube Data API v3'ü arayın ve etkinleştirin.


4. YouTube Oynatma Listesi ID'sini Alın
YouTube'da oluşturduğunuz oynatma listesine gidin.
URL'de list= parametresinden sonra gelen kısmı kopyalayın. Bu oynatma listesinin ID'sidir. .env dosyasındaki YOUTUBE_PLAYLIST_ID alanına bu ID'yi ekleyin.


Projeyi Çalıştırma
Terminalden proje dizinine gidin.
Aşağıdaki komutu çalıştırarak Python dosyasını başlatın:
bash
Kodu kopyala
python Spotify.py
Çalıştırdığınızda, kimlik doğrulama işlemi için bir tarayıcı penceresi açılacaktır. Google hesabınızla giriş yapın ve gerekli izinleri verin.
Giriş yaptıktan sonra, Spotify çalma listenizdeki şarkılar belirtilen YouTube oynatma listesine eklenecektir.
