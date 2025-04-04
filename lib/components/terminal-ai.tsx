import React, { useState, useEffect, useRef } from 'react';

import { getAgent } from '../../app/agents';
import { callTerminalAgent, streamTerminalAgent } from '../mastra-integration';

interface TerminalAIProps {
  onCommand: (command: string) => void;
}

const TerminalAI: React.FC<TerminalAIProps> = ({ onCommand }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Array<{role: string; content: string}>>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [threadId] = useState<string>(`thread-${Date.now()}`);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    // Add user message to chat
    const userMessage = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    
    try {
      // 使用streaming API获取实时响应
      let fullResponse = '';
      
      await streamTerminalAgent(
        input,
        (chunk) => {
          fullResponse += chunk;
          setMessages((prev) => {
            const newMessages = [...prev];
            // 更新或添加Assistant的消息
            const lastMsg = newMessages[newMessages.length - 1];
            if (lastMsg.role === 'assistant') {
              lastMsg.content = fullResponse;
              return [...newMessages];
            } else {
              return [...newMessages, { role: 'assistant', content: fullResponse }];
            }
          });
        },
        threadId
      );
      
      // 从响应中提取命令（如果有）
      const commandMatch = fullResponse.match(/```(bash|sh)?\s*([\s\S]*?)```/);
      if (commandMatch && commandMatch[2]) {
        const command = commandMatch[2].trim();
        // 请求确认执行命令
        setTimeout(() => {
          const shouldExecute = window.confirm(`执行命令: ${command}?`);
          if (shouldExecute) {
            onCommand(command);
          }
        }, 100);
      }
    } catch (error) {
      console.error('与智能体通信出错:', error);
      setMessages((prev) => [...prev, { 
        role: 'assistant', 
        content: '抱歉，处理您的请求时出现了错误。'
      }]);
    } finally {
      setIsLoading(false);
      setInput('');
    }
  };

  const togglePanel = () => {
    setIsOpen(!isOpen);
  };
  
  return (
    <div className={`terminal-ai ${isOpen ? 'open' : 'closed'}`}>
      <button className="toggle-button" onClick={togglePanel}>
        {isOpen ? '关闭AI' : '打开AI'}
      </button>
      
      {isOpen && (
        <div className="panel">
          <div className="messages">
            {messages.length === 0 ? (
              <div className="welcome">
                <h3>终端助手</h3>
                <p>我能如何帮助您处理终端任务？</p>
              </div>
            ) : (
              messages.map((msg, index) => (
                <div key={index} className={`message ${msg.role}`}>
                  <div className="content">{msg.content}</div>
                </div>
              ))
            )}
            {isLoading && (
              <div className="message assistant">
                <div className="content loading">思考中...</div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="询问任何关于终端命令的问题..."
              disabled={isLoading}
            />
            <button type="submit" disabled={isLoading || !input.trim()}>
              发送
            </button>
          </form>
        </div>
      )}
      
      <style jsx>{`
        .terminal-ai {
          position: absolute;
          bottom: 0;
          right: 20px;
          z-index: 100;
        }
        
        .toggle-button {
          position: absolute;
          bottom: 10px;
          right: 0;
          background: #333;
          color: #fff;
          border: none;
          border-radius: 4px;
          padding: 5px 10px;
          cursor: pointer;
          opacity: 0.7;
          transition: opacity 0.2s;
        }
        
        .toggle-button:hover {
          opacity: 1;
        }
        
        .panel {
          position: absolute;
          bottom: 50px;
          right: 0;
          width: 350px;
          height: 400px;
          background: rgba(0, 0, 0, 0.85);
          border-radius: 6px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 5px 15px rgba(0, 0, 0, 0.5);
        }
        
        .messages {
          flex: 1;
          overflow-y: auto;
          padding: 15px;
        }
        
        .welcome {
          text-align: center;
          color: #ddd;
          margin-top: 20px;
        }
        
        .welcome h3 {
          font-size: 16px;
          margin-bottom: 10px;
        }
        
        .message {
          margin-bottom: 10px;
          max-width: 80%;
        }
        
        .message.user {
          margin-left: auto;
        }
        
        .message.assistant {
          margin-right: auto;
        }
        
        .content {
          padding: 8px 12px;
          border-radius: 12px;
          font-size: 13px;
          line-height: 1.4;
          white-space: pre-wrap;
        }
        
        .user .content {
          background: #2b5c84;
          color: white;
          border-radius: 12px 12px 0 12px;
        }
        
        .assistant .content {
          background: #3e3e3e;
          color: #eee;
          border-radius: 12px 12px 12px 0;
        }
        
        .loading {
          opacity: 0.7;
        }
        
        form {
          display: flex;
          padding: 10px;
          background: #222;
          border-top: 1px solid #444;
        }
        
        input {
          flex: 1;
          background: #333;
          color: white;
          border: none;
          padding: 8px 12px;
          border-radius: 4px;
          margin-right: 8px;
        }
        
        button {
          background: #2b5c84;
          color: white;
          border: none;
          padding: 8px 12px;
          border-radius: 4px;
          cursor: pointer;
        }
        
        button:disabled {
          background: #555;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};

export default TerminalAI;