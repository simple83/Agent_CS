import type {
  CreatePostParams, DetailResponse, PostEntity, PostQueryParams, UpdatePostParams,
} from './post.types';

export interface PostApi {
  getPosts(params?: PostQueryParams): Promise<PostEntity[]>;
  getPost(postId: number): Promise<PostEntity>;
  createPost(params: CreatePostParams): Promise<PostEntity>;
  updatePost(postId: number, params: UpdatePostParams): Promise<PostEntity>;
  deletePost(postId: number): Promise<DetailResponse>;
  likePost(postId: number): Promise<DetailResponse>;
  unlikePost(postId: number): Promise<DetailResponse>;
}
