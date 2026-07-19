import spotipy
from spotipy.oauth2 import SpotifyOAuth
import os
from dotenv import load_dotenv
import google_auth_oauthlib.flow
import googleapiclient.discovery
import googleapiclient.errors

# Ortam değişkenlerini yükle
load_dotenv()

# Spotify kimlik bilgilerinizi ortam değişkenlerinden alın
SPOTIPY_CLIENT_ID = os.getenv('SPOTIPY_CLIENT_ID')
SPOTIPY_CLIENT_SECRET = os.getenv('SPOTIPY_CLIENT_SECRET')
SPOTIPY_REDIRECT_URI = os.getenv('SPOTIPY_REDIRECT_URI')

scope = "playlist-read-private"

sp = spotipy.Spotify(auth_manager=SpotifyOAuth(client_id=SPOTIPY_CLIENT_ID,
                                               client_secret=SPOTIPY_CLIENT_SECRET,
                                               redirect_uri=SPOTIPY_REDIRECT_URI,
                                               scope=scope))

playlist_id = '5yer0Jb8YA4ThrIjw023gb'  # Spotify çalma listesi ID'sini buraya ekleyin
results = sp.playlist_items(playlist_id)

tracks = results['items']
for item in tracks:
    track = item['track']
    print(f"Track Name: {track['name']} - Artist: {track['artists'][0]['name']}")

# Google API kimlik bilgilerinizi ayarlayın
scopes = ["https://www.googleapis.com/auth/youtube.force-ssl"]

def authenticate_youtube():
    os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"
    api_service_name = "youtube"
    api_version = "v3"
    client_secrets_file = os.getenv('YOUTUBE_CLIENT_SECRET_PATH')  # Ortam değişkeninden al

    flow = google_auth_oauthlib.flow.InstalledAppFlow.from_client_secrets_file(
        client_secrets_file, scopes)
    credentials = flow.run_local_server(port=0)  # run_console() yerine run_local_server() kullanın
    youtube = googleapiclient.discovery.build(
        api_service_name, api_version, credentials=credentials)

    return youtube

# OAuth kimlik doğrulaması yaparak YouTube istemcisini alın
youtube = authenticate_youtube()

def search_youtube(track_name, artist_name):
    search_response = youtube.search().list(
        q=f"{track_name} {artist_name}",
        part='id,snippet',
        maxResults=1
    ).execute()

    return search_response.get('items', [])[0]['id']['videoId']

def add_to_playlist(youtube, playlist_id, video_id):
    youtube.playlistItems().insert(
        part="snippet",
        body={
            "snippet": {
                "playlistId": playlist_id,
                "resourceId": {
                    "kind": "youtube#video",
                    "videoId": video_id
                }
            }
        }
    ).execute()

# Spotify'dan aldığınız çalma listesi şarkılarını kullanın
playlist_id = os.getenv('YOUTUBE_PLAYLIST_ID')  # Ortam değişkeninden al

for item in tracks:
    track = item['track']
    track_name = track['name']
    artist_name = track['artists'][0]['name']
    
    video_id = search_youtube(track_name, artist_name)
    add_to_playlist(youtube, playlist_id, video_id)
    print(f"Added {track_name} by {artist_name} to YouTube playlist")
