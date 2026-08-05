// Sample library for demo mode (no Firebase config). Enough songs to show
// search, tags, favorites and browse-by-artist working, and two with a tempo
// set so Play works end to end. Lyrics kept short — placeholders, not full
// copyrighted texts — since demo mode is for seeing the app, not using it.
import { emptySong } from '../lib/songs.js';

const song = (o) => ({ ...emptySong(), id: 'seed_' + o.id, createdAt: o.createdAt, ...o });

export const SEED_SONGS = [
  song({
    id: 'wonderwall',
    createdAt: 1,
    title: 'Wonderwall',
    artist: 'Oasis',
    bpm: 87,
    bpmSource: 'manual',
    favorite: true,
    tags: ['britpop', 'campfire'],
    lyrics:
      '[Verse 1]\nToday is gonna be the day\nThat they’re gonna throw it back to you\nBy now you should’ve somehow\nRealized what you gotta do\n\n[Chorus]\nAnd all the roads we have to walk are winding\nAnd all the lights that lead us there are blinding\n\n…demo lyrics — replace with the real ones once the app is set up',
    links: [{ url: 'https://www.youtube.com/watch?v=6hzrDeceEKc', label: 'Original' }],
  }),
  song({
    id: 'blackbird',
    createdAt: 2,
    title: 'Blackbird',
    artist: 'The Beatles',
    bpm: 96,
    bpmSource: 'manual',
    tags: ['fingerstyle', 'campfire'],
    lyrics:
      '[Verse 1]\nBlackbird singing in the dead of night\nTake these broken wings and learn to fly\n\n[Verse 2]\nBlackbird fly\nInto the light of the dark black night\n\n…demo lyrics — replace with the real ones once the app is set up',
    links: [{ url: 'https://www.youtube.com/watch?v=Man4Xw8Xypo', label: 'Tutorial' }],
  }),
  song({
    id: 'yellow',
    createdAt: 3,
    title: 'Yellow',
    artist: 'Coldplay',
    tags: ['alt-rock'],
    lyrics:
      '[Verse 1]\nLook at the stars\nLook how they shine for you\nAnd everything you do\n\n…demo lyrics — replace with the real ones once the app is set up',
  }),
  song({
    id: 'blackhole',
    createdAt: 4,
    title: 'Black Hole Sun',
    artist: 'Soundgarden',
    favorite: true,
    tags: ['grunge', '90s'],
    lyrics:
      '[Chorus]\nBlack hole sun\nWon’t you come\nAnd wash away the rain\n\n…demo lyrics — replace with the real ones once the app is set up',
  }),
  song({
    id: 'even-flow',
    createdAt: 5,
    title: 'Even Flow',
    artist: 'Pearl Jam',
    tags: ['grunge', '90s'],
    lyrics:
      '[Verse 1]\nFreezin’, rests his head on a pillow made of concrete\nAgain\n\n…demo lyrics — replace with the real ones once the app is set up',
  }),
  song({
    id: 'alive',
    createdAt: 6,
    title: 'Alive',
    artist: 'Pearl Jam',
    tags: ['grunge'],
    lyrics:
      '[Chorus]\nOh, I, oh, I’m still alive\nHey, I, oh, I’m still alive\n\n…demo lyrics — replace with the real ones once the app is set up',
  }),
];
