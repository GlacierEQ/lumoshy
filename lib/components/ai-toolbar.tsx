import React from 'react';
import { useState } from 'react';

// 导入图标(按字母顺序)
import { VscActivateBreakpoints } from '@react-icons/all-files/vsc/VscActivateBreakpoints';
import { VscCode } from '@react-icons/all-files/vsc/VscCode';
import { VscDebugConsole } from '@react-icons/all-files/vsc/VscDebugConsole';
import { VscRemote } from '@react-icons/all-files/vsc/VscRemote';
import { VscRocket } from '@react-icons/all-files/vsc/VscRocket';
import { VscSearch } from '@react-icons/all-files/vsc/VscSearch';
import { VscSymbolKeyword } from '@react-icons/all-files/vsc/VscSymbolKeyword';
import { VscTerminal } from '@react-icons/all-files/vsc/VscTerminal';
import { VscTools } from '@react-icons/all-files/vsc/VscTools';

import { callTerminalAgentWithContext } from '../mastra-connector';
import { parseCommandForExecution } from '../utils/command-parser';

interface AIToolbarProps {
  onCommand: (command: string) => void;
  aiMode: boolean;
  onToggleAIMode: () => void;
}

const AIToolbar: React.FC<AIToolbarProps> = ({ onCommand, aiMode, onToggleAIMode }) => {
  const [input, setInput] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [threadId] = useState<string>(`aitools-${Date.now()}`);

  // 命令类别
  const categories = [
    { id: 'install', name: '安装', icon: <VscRocket />, shortcut: '⌘ 1' },
    { id: 'code', name: '代码', icon: <VscCode />, shortcut: '⌘ 2' },
    { id: 'deploy', name: '部署', icon: <VscRemote />, shortcut: '⌘ 3' }
  ];

  // 处理命令搜索提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !aiMode) return;
    
    setIsLoading(true);
    
    try {
      // 使用上下文感知的终端智能体生成命令
      const response = await callTerminalAgentWithContext(input, threadId);
      
      // 使用命令解析工具从响应中提取命令
      const command = parseCommandForExecution(response);
      
      if (command) {
        if (window.confirm(`执行命令: ${command}?`)) {
          onCommand(command);
        }
      } else {
        // 如果没有找到命令格式，显示整个响应
        alert(response);
      }
    } catch (error) {
      console.error('AI命令生成失败:', error);
      alert('生成命令时出错，请重试');
    } finally {
      setIsLoading(false);
      setInput('');
      setIsSearchOpen(false);
    }
  };

  // 打开命令搜索
  const openCommandSearch = () => {
    setIsSearchOpen(true);
    setTimeout(() => {
      const inputElement = document.getElementById('command-search-input');
      if (inputElement) inputElement.focus();
    }, 0);
  };

  // 切换AI模式
  const toggleAIMode = () => {
    onToggleAIMode();
    if (!aiMode) {
      // 如果从普通模式切换到AI模式，显示欢迎消息
      setTimeout(() => {
        alert('AI模式已启用！现在你可以使用自然语言描述你的需求。');
      }, 100);
    }
  };

  return (
    <div className={`ai-toolbar ${aiMode ? 'ai-mode' : 'normal-mode'}`}>
      {/* 工具栏内容 */}
      <div className="toolbar-content">
        {/* 左侧分类按钮 */}
        <div className="toolbar-categories">
          {categories.map(category => (
            <button 
              key={category.id} 
              className="category-button" 
              title={`${category.name} (${category.shortcut})`}
              onClick={() => alert(`${category.name}功能正在开发中`)}
            >
              <span className="category-icon">{category.icon}</span>
              <span className="category-name">{category.name}</span>
              <span className="category-shortcut">{category.shortcut}</span>
            </button>
          ))}

          {/* AI模式切换器 */}
          <div className="ai-mode-indicator">
            <button 
              className={`ai-mode-toggle ${aiMode ? 'active' : ''}`} 
              onClick={toggleAIMode}
              title={aiMode ? "AI模式已启用" : "启用AI模式"}
            >
              <VscActivateBreakpoints />
              <span>AI模式</span>
            </button>
          </div>
        </div>

        {/* 右侧工具按钮 */}
        <div className="toolbar-tools">
          {/* 命令搜索按钮 */}
          <button 
            className="tool-button" 
            onClick={openCommandSearch}
            title="命令搜索 (⌘ P)"
          >
            <VscSearch />
          </button>

          {/* 命令面板按钮 */}
          <button 
            className="tool-button" 
            onClick={() => alert('命令面板功能正在开发中')}
            title="命令面板 (⌘⇧ P)"
          >
            <VscTerminal />
          </button>
          
          {/* 工具箱按钮 */}
          <button 
            className="tool-button" 
            onClick={() => alert('工具箱功能正在开发中')}
            title="工具箱"
          >
            <VscTools />
          </button>
          
          {/* 调试控制台按钮 */}
          <button 
            className="tool-button" 
            onClick={() => alert('调试控制台功能正在开发中')}
            title="调试控制台"
          >
            <VscDebugConsole />
          </button>
        </div>
      </div>

      {/* 命令搜索输入框 */}
      {isSearchOpen && (
        <div className="command-search-overlay" onClick={() => setIsSearchOpen(false)}>
          <div className="command-search-container" onClick={e => e.stopPropagation()}>
            <form onSubmit={handleSubmit}>
              <div className="command-search-wrapper">
                <span className="search-icon"><VscSearch /></span>
                <input
                  id="command-search-input"
                  type="text"
                  placeholder={aiMode ? "用自然语言描述你想做什么..." : "输入命令..."}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  disabled={isLoading}
                />
                {isLoading && <span className="loading-indicator">处理中...</span>}
                <div className="command-search-shortcut">ESC</div>
              </div>
              <div className="search-mode-indicator">
                {aiMode ? (
                  <span className="ai-mode-badge">
                    <VscActivateBreakpoints /> AI模式
                  </span>
                ) : (
                  <span className="normal-mode-badge">
                    <VscSymbolKeyword /> 普通模式
                  </span>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 样式 */}
      <style jsx>{`
        .ai-toolbar {
          width: 100%;
          background-color: #121212;
          color: #e1e1e1;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
          font-size: 13px;
          border-bottom: 1px solid #333;
          height: 36px;
          display: flex;
          align-items: center;
          padding: 0 15px;
          position: relative;
          z-index: 9;
        }

        .ai-mode {
          background: linear-gradient(90deg, #121212 0%, #0d1117 100%);
        }

        .toolbar-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
        }

        .toolbar-categories {
          display: flex;
          align-items: center;
        }

        .category-button {
          display: flex;
          align-items: center;
          background: none;
          border: none;
          color: #9e9e9e;
          padding: 0 12px;
          height: 32px;
          cursor: pointer;
          border-radius: 4px;
          margin-right: 6px;
          transition: background-color 0.2s, color 0.2s;
        }

        .category-button:hover {
          background-color: rgba(255, 255, 255, 0.1);
          color: #fff;
        }

        .category-icon {
          margin-right: 6px;
          display: flex;
          align-items: center;
        }

        .category-shortcut {
          margin-left: 8px;
          opacity: 0.5;
          font-size: 11px;
        }

        .ai-mode-indicator {
          margin-left: 15px;
          display: flex;
          align-items: center;
        }

        .ai-mode-toggle {
          display: flex;
          align-items: center;
          background: #292929;
          border: 1px solid #454545;
          color: #9e9e9e;
          padding: 3px 8px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s;
        }

        .ai-mode-toggle span {
          margin-left: 5px;
        }

        .ai-mode-toggle.active {
          background: linear-gradient(90deg, #2b5c84 0%, #3a7ca5 100%);
          color: white;
          border-color: #4a8bba;
        }

        .toolbar-tools {
          display: flex;
          align-items: center;
        }

        .tool-button {
          display: flex;
          align-items: center;
          justify-content: center;
          background: none;
          border: none;
          color: #9e9e9e;
          width: 32px;
          height: 32px;
          cursor: pointer;
          border-radius: 4px;
          margin-left: 2px;
          transition: background-color 0.2s, color 0.2s;
        }

        .tool-button:hover {
          background-color: rgba(255, 255, 255, 0.1);
          color: #fff;
        }

        .command-search-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.5);
          display: flex;
          justify-content: center;
          align-items: flex-start;
          padding-top: 100px;
          z-index: 1000;
        }

        .command-search-container {
          width: 600px;
          background-color: #1e1e1e;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
        }

        .command-search-wrapper {
          display: flex;
          align-items: center;
          padding: 10px 15px;
          border-bottom: 1px solid #333;
          position: relative;
        }

        .search-icon {
          color: #9e9e9e;
          margin-right: 10px;
          display: flex;
        }

        .command-search-wrapper input {
          flex: 1;
          background: none;
          border: none;
          color: white;
          font-size: 14px;
          padding: 5px 0;
          outline: none;
        }

        .command-search-shortcut {
          padding: 2px 6px;
          background-color: #333;
          border-radius: 4px;
          color: #9e9e9e;
          font-size: 11px;
        }

        .loading-indicator {
          color: #9e9e9e;
          margin-right: 10px;
          font-size: 12px;
          font-style: italic;
        }

        .search-mode-indicator {
          padding: 8px 15px;
          display: flex;
          justify-content: flex-end;
          font-size: 12px;
        }

        .ai-mode-badge, .normal-mode-badge {
          display: flex;
          align-items: center;
          padding: 3px 8px;
          border-radius: 4px;
          background-color: #292929;
        }

        .ai-mode-badge {
          color: #4a8bba;
        }

        .normal-mode-badge {
          color: #9e9e9e;
        }

        .ai-mode-badge svg, .normal-mode-badge svg {
          margin-right: 5px;
        }
      `}</style>
    </div>
  );
};

export default AIToolbar; 