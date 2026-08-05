import { useEffect, useState } from 'react';
import TabBar from './components/TabBar.jsx';
import SignInScreen from './screens/SignInScreen.jsx';
import LibraryScreen from './screens/LibraryScreen.jsx';
import ArtistsScreen from './screens/ArtistsScreen.jsx';
import SongDetailScreen from './screens/SongDetailScreen.jsx';
import EditScreen from './screens/EditScreen.jsx';
import AddScreen from './screens/AddScreen.jsx';
import PlayScreen from './screens/PlayScreen.jsx';
import SettingsScreen from './screens/SettingsScreen.jsx';
import { useAppStore } from './lib/store.js';
import { allTags } from './lib/songs.js';
import { importFromUrl, sharedUrlFromLocation } from './lib/importer.js';

const shell = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  maxWidth: 640,
  margin: '0 auto',
  background: 'var(--color-bg)',
  position: 'relative',
};

export default function App() {
  const store = useAppStore();
  const { api } = store;
  const [screen, setScreen] = useState('library');
  const [selectedId, setSelectedId] = useState(null);
  const [playingId, setPlayingId] = useState(null);
  const [draft, setDraft] = useState(null); // { song, title }
  const [artistFilter, setArtistFilter] = useState(null);

  const songs = store.songs;
  const selected = songs.find((s) => s.id === selectedId) || null;
  const playing = songs.find((s) => s.id === playingId) || null;
  const tagSuggestions = allTags(songs);

  // Android share target (spec §5.3): a shared link arrives as ?url= / ?text=.
  useEffect(() => {
    if (store.authStep !== 'ok') return;
    const shared = sharedUrlFromLocation(window.location.search);
    if (!shared) return;
    window.history.replaceState({}, '', window.location.pathname);
    importFromUrl(shared).then((res) => {
      if (res.song) {
        setDraft({ song: res.song, title: 'Review import' });
        setScreen('edit');
      } else {
        setScreen('add');
      }
    });
  }, [store.authStep]);

  // Auth gates (cloud mode only; demo mode is always 'ok').
  if (store.authStep !== 'ok') {
    if (store.authStep === 'loading') {
      return (
        <div style={{ ...shell, alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 13, letterSpacing: '0.1em', color: 'var(--color-neutral-500)' }}>LOADING…</div>
        </div>
      );
    }
    return (
      <div style={shell}>
        <SignInScreen
          authStep={store.authStep}
          authError={store.authError}
          user={store.user}
          allowlist={store.allowlist}
          onSignIn={api.signIn}
          onSignOut={api.signOutUser}
        />
      </div>
    );
  }

  // Full-screen play view takes over (tab bar hidden).
  if (playing) {
    return (
      <PlayScreen
        song={playing}
        onExit={() => {
          setPlayingId(null);
        }}
        onCalibrate={(id, lpb) => api.updateSong(id, { linesPerBeat: lpb })}
      />
    );
  }

  const openSong = (id) => {
    setSelectedId(id);
    setScreen('detail');
  };
  const play = (id) => setPlayingId(id);

  const saveDraft = (song) => {
    const existing = songs.some((s) => s.id === song.id);
    if (existing) api.updateSong(song.id, song);
    else api.addSong(song);
    setDraft(null);
    setSelectedId(song.id);
    setScreen('detail');
  };

  let body;
  if (screen === 'detail' && selected) {
    body = (
      <SongDetailScreen
        song={selected}
        onBack={() => setScreen('library')}
        onPlay={play}
        onEdit={(s) => {
          setDraft({ song: s, title: 'Edit song' });
          setScreen('edit');
        }}
        onDelete={(id) => {
          api.deleteSong(id);
          setScreen('library');
        }}
        onFavorite={api.toggleFavorite}
        onPatch={api.updateSong}
      />
    );
  } else if (screen === 'edit' && draft) {
    body = (
      <EditScreen
        initial={draft.song}
        title={draft.title}
        tagSuggestions={tagSuggestions}
        onSave={saveDraft}
        onCancel={() => {
          setDraft(null);
          setScreen(selected ? 'detail' : 'add');
        }}
      />
    );
  } else if (screen === 'artists') {
    body = (
      <ArtistsScreen
        songs={songs}
        onPick={(artist) => {
          setArtistFilter(artist);
          setScreen('library');
        }}
      />
    );
  } else if (screen === 'add') {
    body = (
      <AddScreen
        onDraft={(song, title) => {
          setDraft({ song, title });
          setScreen('edit');
        }}
        onBlank={(song) => {
          setDraft({ song, title: 'New song' });
          setScreen('edit');
        }}
      />
    );
  } else if (screen === 'settings') {
    body = (
      <SettingsScreen
        mode={store.mode}
        user={store.user}
        songCount={songs.length}
        allowlist={store.allowlist}
        onSignOut={api.signOutUser}
      />
    );
  } else {
    body = (
      <LibraryScreen
        songs={songs}
        artistFilter={artistFilter}
        onClearArtist={() => setArtistFilter(null)}
        onOpen={openSong}
        onPlay={play}
        onFavorite={api.toggleFavorite}
        onCopyIn={{
          load: api.loadEveryone,
          copy: async (song, fromName) => {
            const copy = await api.copyIn(song, fromName);
            if (copy) openSong(copy.id);
          },
        }}
      />
    );
  }

  const showTabs = screen !== 'edit' && screen !== 'detail';

  return (
    <div style={shell}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>{body}</div>
      {showTabs && (
        <TabBar
          screen={screen}
          onGo={(key) => {
            setSelectedId(null);
            setDraft(null);
            if (key === 'library') setArtistFilter(null);
            setScreen(key);
          }}
        />
      )}
    </div>
  );
}
