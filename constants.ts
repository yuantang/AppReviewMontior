import { AppProduct, Review, Sentiment } from './types';

export const MOCK_APPS: AppProduct[] = [
  {
    id: 1,
    app_store_id: '123456789',
    name: 'PhotoEditor Pro',
    bundle_id: 'com.company.photoeditor',
    platform: 'ios',
    icon_url: 'https://picsum.photos/id/20/100/100'
  },
  {
    id: 2,
    app_store_id: '987654321',
    name: 'Fitness Tracker AI',
    bundle_id: 'com.company.fitness',
    platform: 'ios',
    icon_url: 'https://picsum.photos/id/30/100/100'
  }
];

export const TOPICS = ['crash', 'pay', 'ads', 'bug', 'feature_request', 'ui/ux', 'performance'];

export const MOCK_REVIEWS: Review[] = [
  {
    id: 1,
    app_id: 1,
    review_id: 'r1001',
    user_name: 'Alice_Photographer',
    title: 'Great filters but crashes often',
    body: 'I really love the vintage filters, they are the best on the store. However, the app crashes every time I try to export in 4K. Please fix this!',
    rating: 3,
    territory: 'US',
    language_code: 'en',
    app_version: '2.1.0',
    is_edited: false,
    created_at_store: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
    sentiment: Sentiment.Neutral,
    topics: ['crash', 'performance'],
    need_reply: true
  },
  {
    id: 2,
    app_id: 1,
    review_id: 'r1002',
    user_name: 'JohnDoe99',
    title: 'Too many ads',
    body: 'Unusable. An ad pops up after every single click. I understand you need to make money, but this is ridiculous.',
    rating: 1,
    territory: 'GB',
    language_code: 'en',
    app_version: '2.1.0',
    is_edited: false,
    created_at_store: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
    sentiment: Sentiment.Negative,
    topics: ['ads', 'ui/ux'],
    need_reply: true
  },
  {
    id: 3,
    app_id: 2,
    review_id: 'r2001',
    user_name: 'SarahFit',
    title: 'Amazing tracking features',
    body: 'The AI coaching is surprisingly good. It actually adapts to my pace. Worth the subscription!',
    rating: 5,
    territory: 'US',
    language_code: 'en',
    app_version: '1.0.5',
    is_edited: false,
    created_at_store: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    sentiment: Sentiment.Positive,
    topics: ['pay', 'feature_request'],
    need_reply: false
  },
  {
    id: 4,
    app_id: 1,
    review_id: 'r1003',
    user_name: 'DesignPro',
    title: 'Subscription issue',
    body: 'I paid for the pro version but it still says I am on the free tier. Restore purchase does not work.',
    rating: 1,
    territory: 'CA',
    language_code: 'en',
    app_version: '2.0.9',
    is_edited: true,
    created_at_store: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    sentiment: Sentiment.Negative,
    topics: ['pay', 'bug'],
    need_reply: true
  },
  {
    id: 5,
    app_id: 2,
    review_id: 'r2002',
    user_name: 'GymRat',
    title: 'Good but needs dark mode',
    body: 'Solid app. Please add dark mode support for late night workouts.',
    rating: 4,
    territory: 'AU',
    language_code: 'en',
    app_version: '1.0.5',
    is_edited: false,
    created_at_store: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    sentiment: Sentiment.Positive,
    topics: ['feature_request'],
    need_reply: false
  }
];
