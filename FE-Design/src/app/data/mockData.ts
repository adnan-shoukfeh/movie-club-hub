export interface User {
  id: string;
  name: string;
  avatar: string;
}

export interface Movie {
  id: string;
  title: string;
  year: number;
  poster: string;
  director: string;
  runtime: number;
  genre: string[];
}

export interface Rating {
  userId: string;
  rating: number;
  review?: string;
  timestamp: string;
}

export interface Turn {
  id: string;
  turnNumber: number;
  movieId: string;
  pickerId: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isEnded: boolean;
  ratings: Rating[];
  watchedBy: string[];
}

export interface Club {
  id: string;
  name: string;
  description: string;
  memberIds: string[];
  adminIds: string[];
  ownerId: string;
  turns: Turn[];
  suggestions: MovieSuggestion[];
  settings: {
    selectionLocked: boolean;
    reviewWindowLocked: boolean;
  };
}

export interface MovieSuggestion {
  id: string;
  movieId: string;
  nominatedBy: string;
  timestamp: string;
}

export const currentUserId = "user1";

export const users: Record<string, User> = {
  user1: { id: "user1", name: "You", avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop" },
  user2: { id: "user2", name: "Sarah Chen", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop" },
  user3: { id: "user3", name: "Marcus Johnson", avatar: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=100&h=100&fit=crop" },
  user4: { id: "user4", name: "Emily Rodriguez", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop" },
  user5: { id: "user5", name: "David Kim", avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop" },
};

export const movies: Record<string, Movie> = {
  movie1: {
    id: "movie1",
    title: "The Grand Budapest Hotel",
    year: 2014,
    poster: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400&h=600&fit=crop",
    director: "Wes Anderson",
    runtime: 99,
    genre: ["Comedy", "Drama"],
  },
  movie2: {
    id: "movie2",
    title: "Parasite",
    year: 2019,
    poster: "https://images.unsplash.com/photo-1594908900066-3f47337549d8?w=400&h=600&fit=crop",
    director: "Bong Joon-ho",
    runtime: 132,
    genre: ["Thriller", "Drama"],
  },
  movie3: {
    id: "movie3",
    title: "Moonlight",
    year: 2016,
    poster: "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=400&h=600&fit=crop",
    director: "Barry Jenkins",
    runtime: 111,
    genre: ["Drama"],
  },
  movie4: {
    id: "movie4",
    title: "Everything Everywhere All at Once",
    year: 2022,
    poster: "https://images.unsplash.com/photo-1598899134739-24c46f58b8c0?w=400&h=600&fit=crop",
    director: "Daniels",
    runtime: 139,
    genre: ["Action", "Comedy", "Drama"],
  },
  movie5: {
    id: "movie5",
    title: "Blade Runner 2049",
    year: 2017,
    poster: "https://images.unsplash.com/photo-1518676590629-3dcbd9c5a5c9?w=400&h=600&fit=crop",
    director: "Denis Villeneuve",
    runtime: 164,
    genre: ["Sci-Fi", "Thriller"],
  },
};

export const clubs: Record<string, Club> = {
  club1: {
    id: "club1",
    name: "Indie Film Lovers",
    description: "A club for exploring independent and art house cinema",
    memberIds: ["user1", "user2", "user3", "user4"],
    adminIds: ["user1", "user2"],
    ownerId: "user1",
    settings: {
      selectionLocked: false,
      reviewWindowLocked: false,
    },
    suggestions: [
      { id: "sug1", movieId: "movie5", nominatedBy: "user3", timestamp: "2026-04-15T10:00:00Z" },
    ],
    turns: [
      {
        id: "turn1",
        turnNumber: 1,
        movieId: "movie1",
        pickerId: "user2",
        startDate: "2026-03-01",
        endDate: "2026-03-15",
        isActive: false,
        isEnded: true,
        watchedBy: ["user1", "user2", "user3", "user4"],
        ratings: [
          { userId: "user1", rating: 4.5, review: "Absolutely delightful! The visual style is impeccable.", timestamp: "2026-03-10T14:30:00Z" },
          { userId: "user2", rating: 5, review: "A masterpiece of cinematography and storytelling.", timestamp: "2026-03-11T09:15:00Z" },
          { userId: "user3", rating: 4, review: "Charming and whimsical, though a bit style over substance.", timestamp: "2026-03-12T20:00:00Z" },
          { userId: "user4", rating: 4.5, timestamp: "2026-03-13T16:45:00Z" },
        ],
      },
      {
        id: "turn2",
        turnNumber: 2,
        movieId: "movie2",
        pickerId: "user3",
        startDate: "2026-03-16",
        endDate: "2026-03-30",
        isActive: false,
        isEnded: true,
        watchedBy: ["user1", "user2", "user3", "user4"],
        ratings: [
          { userId: "user1", rating: 5, review: "Brilliant social commentary wrapped in a thrilling narrative.", timestamp: "2026-03-25T18:00:00Z" },
          { userId: "user2", rating: 5, review: "Every frame is perfect. A modern classic.", timestamp: "2026-03-26T12:00:00Z" },
          { userId: "user3", rating: 4.5, review: "Tense, clever, and unforgettable.", timestamp: "2026-03-27T21:30:00Z" },
          { userId: "user4", rating: 5, timestamp: "2026-03-28T10:15:00Z" },
        ],
      },
      {
        id: "turn3",
        turnNumber: 3,
        movieId: "movie3",
        pickerId: "user1",
        startDate: "2026-04-01",
        endDate: "2026-04-28",
        isActive: true,
        isEnded: false,
        watchedBy: ["user1", "user2", "user4"],
        ratings: [
          { userId: "user1", rating: 5, review: "A deeply moving and beautifully crafted film.", timestamp: "2026-04-20T19:00:00Z" },
          { userId: "user4", rating: 4.5, timestamp: "2026-04-22T15:30:00Z" },
        ],
      },
    ],
  },
  club2: {
    id: "club2",
    name: "Sci-Fi Saturdays",
    description: "Science fiction films every other week",
    memberIds: ["user1", "user5"],
    adminIds: ["user5"],
    ownerId: "user5",
    settings: {
      selectionLocked: true,
      reviewWindowLocked: true,
    },
    suggestions: [],
    turns: [
      {
        id: "turn4",
        turnNumber: 1,
        movieId: "movie4",
        pickerId: "user5",
        startDate: "2026-04-15",
        endDate: "2026-04-29",
        isActive: true,
        isEnded: false,
        watchedBy: ["user1"],
        ratings: [],
      },
    ],
  },
};

export const recentMovies = [
  { movieId: "movie1", rating: 4.5, watchedDate: "2026-03-10" },
  { movieId: "movie2", rating: 5, watchedDate: "2026-03-25" },
  { movieId: "movie3", rating: 5, watchedDate: "2026-04-20" },
];
