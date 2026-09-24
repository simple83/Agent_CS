//코드블럭 하이라이트 스타일 적용
//API의 content의 저장방식은 유지하고, 프론트에서 해석해서 보여주기

import Markdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';

import 'highlight.js/styles/github-dark.css';
import './PostContent.css';

interface PostContentProps {
  content: string;
}

export const PostContent = ({ content }: PostContentProps) => {
  return (
    <div className="post-content">
      <Markdown rehypePlugins={[rehypeHighlight]}>
        {content}
      </Markdown>
    </div>
  );
};