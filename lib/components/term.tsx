import {clipboard, shell} from 'electron';
import React from 'react';

import Color from 'color';
import isEqual from 'lodash/isEqual';
import pickBy from 'lodash/pickBy';
import {Terminal} from 'xterm';
import type {ITerminalOptions, IDisposable} from 'xterm';
import {CanvasAddon} from 'xterm-addon-canvas';
import {FitAddon} from 'xterm-addon-fit';
import {ImageAddon} from 'xterm-addon-image';
import {LigaturesAddon} from 'xterm-addon-ligatures';
import {SearchAddon} from 'xterm-addon-search';
import type {ISearchDecorationOptions} from 'xterm-addon-search';
import {Unicode11Addon} from 'xterm-addon-unicode11';
import {WebLinksAddon} from 'xterm-addon-web-links';
import {WebglAddon} from 'xterm-addon-webgl';

import type {TermProps} from '../../typings/hyper';
import {callTerminalAgentWithContext} from '../mastra-connector';
import terms from '../terms';
import {parseCommandForExecution} from '../utils/command-parser';
import processClipboard from '../utils/paste';
import {decorate} from '../utils/plugins';

import _SearchBox from './searchBox';

import 'xterm/css/xterm.css';

const SearchBox = decorate(_SearchBox, 'SearchBox');

const isWindows = ['Windows', 'Win16', 'Win32', 'WinCE'].includes(navigator.platform) || process.platform === 'win32';

// map old hterm constants to xterm.js
const CURSOR_STYLES = {
  BEAM: 'bar',
  UNDERLINE: 'underline',
  BLOCK: 'block'
} as const;

// AI 模式相关常量
// const AI_MODE_PREFIX = '\x1b[36m[AI]\x1b[0m '; // 青色的 [AI] 前缀，暂时不使用
const AI_PROCESSING_MESSAGE = '\r\n\x1b[36m[AI 处理中...]\x1b[0m';
const AI_MODE_ENABLED_MESSAGE = '\r\n\x1b[36m[AI模式已开启，请使用自然语言描述命令]\x1b[0m\r\n';
const AI_MODE_DISABLED_MESSAGE = '\r\n\x1b[33m[AI模式已关闭]\x1b[0m\r\n';
const AI_ERROR_MESSAGE = '\r\n\x1b[31m[AI错误]: ';
const AI_PROMPT = '\r\n\x1b[36m请输入您想要执行的操作: \x1b[0m';
const AI_MODE_SHORTCUT = 'Ctrl+Space 或 Alt+Space';

const isWebgl2Supported = (() => {
  let isSupported = window.WebGL2RenderingContext ? undefined : false;
  return () => {
    if (isSupported === undefined) {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2', {depth: false, antialias: false});
      isSupported = gl instanceof window.WebGL2RenderingContext;
    }
    return isSupported;
  };
})();

const getTermOptions = (props: TermProps): ITerminalOptions => {
  // Set a background color only if it is opaque
  const needTransparency = Color(props.backgroundColor).alpha() < 1;
  const backgroundColor = needTransparency ? 'rgba(0,0,0,0)' : props.backgroundColor;

  return {
    macOptionIsMeta: props.modifierKeys.altIsMeta,
    scrollback: props.scrollback,
    cursorStyle: CURSOR_STYLES[props.cursorShape],
    cursorBlink: props.cursorBlink,
    fontFamily: props.fontFamily,
    fontSize: props.fontSize,
    fontWeight: props.fontWeight,
    fontWeightBold: props.fontWeightBold,
    lineHeight: props.lineHeight,
    letterSpacing: props.letterSpacing,
    allowTransparency: needTransparency,
    macOptionClickForcesSelection: props.macOptionSelectionMode === 'force',
    windowsMode: isWindows,
    ...(isWindows && props.windowsPty && {windowsPty: props.windowsPty}),
    theme: {
      foreground: props.foregroundColor,
      background: backgroundColor,
      cursor: props.cursorColor,
      cursorAccent: props.cursorAccentColor,
      selectionBackground: props.selectionColor,
      black: props.colors.black,
      red: props.colors.red,
      green: props.colors.green,
      yellow: props.colors.yellow,
      blue: props.colors.blue,
      magenta: props.colors.magenta,
      cyan: props.colors.cyan,
      white: props.colors.white,
      brightBlack: props.colors.lightBlack,
      brightRed: props.colors.lightRed,
      brightGreen: props.colors.lightGreen,
      brightYellow: props.colors.lightYellow,
      brightBlue: props.colors.lightBlue,
      brightMagenta: props.colors.lightMagenta,
      brightCyan: props.colors.lightCyan,
      brightWhite: props.colors.lightWhite
    },
    screenReaderMode: props.screenReaderMode,
    overviewRulerWidth: 20,
    allowProposedApi: true
  };
};

export default class Term extends React.PureComponent<
  TermProps,
  {
    searchOptions: {
      caseSensitive: boolean;
      wholeWord: boolean;
      regex: boolean;
    };
    searchResults:
      | {
          resultIndex: number;
          resultCount: number;
        }
      | undefined;
    cursorPosition?: {
      x: number;
      y: number;
      width: number;
      height: number;
      col: number;
      row: number;
    };
    aiMode: boolean;
    isProcessingAI: boolean;
  }
> {
  termRef: HTMLElement | null;
  termWrapperRef: HTMLElement | null;
  termOptions: ITerminalOptions;
  disposableListeners: IDisposable[];
  defaultBellSound: HTMLAudioElement | null;
  bellSound: HTMLAudioElement | null;
  fitAddon: FitAddon;
  searchAddon: SearchAddon;
  static rendererTypes: Record<string, string>;
  term!: Terminal;
  resizeObserver!: ResizeObserver;
  resizeTimeout!: NodeJS.Timeout;
  searchDecorations: ISearchDecorationOptions;
  aiThreadId: string; // 用于追踪 AI 对话
  currentInputLine: string; // 当前输入行
  state = {
    searchOptions: {
      caseSensitive: false,
      wholeWord: false,
      regex: false
    },
    searchResults: undefined,
    cursorPosition: undefined,
    aiMode: false,
    isProcessingAI: false
  };

  constructor(props: TermProps) {
    super(props);
    props.ref_(props.uid, this);
    this.termRef = null;
    this.termWrapperRef = null;
    this.termOptions = {};
    this.disposableListeners = [];
    this.defaultBellSound = null;
    this.bellSound = null;
    this.fitAddon = new FitAddon();
    this.searchAddon = new SearchAddon();
    this.searchDecorations = {
      activeMatchColorOverviewRuler: Color(this.props.cursorColor).hex(),
      matchOverviewRuler: Color(this.props.borderColor).hex(),
      activeMatchBackground: Color(this.props.cursorColor).hex(),
      activeMatchBorder: Color(this.props.cursorColor).hex(),
      matchBorder: Color(this.props.cursorColor).hex()
    };
    this.aiThreadId = `terminal-${Date.now()}`;
    this.currentInputLine = '';
  }

  // The main process shows this in the About dialog
  static reportRenderer(uid: string, type: string) {
    const rendererTypes = Term.rendererTypes || {};
    if (rendererTypes[uid] !== type) {
      rendererTypes[uid] = type;
      Term.rendererTypes = rendererTypes;
      window.rpc.emit('info renderer', {uid, type});
    }
  }

  componentDidMount() {
    const {props} = this;

    this.termOptions = getTermOptions(props);
    this.term = props.term || new Terminal(this.termOptions);
    this.defaultBellSound = new Audio(
      // Source: https://freesound.org/people/altemark/sounds/45759/
      // This sound is released under the Creative Commons Attribution 3.0 Unported
      // (CC BY 3.0) license. It was created by 'altemark'. No modifications have been
      // made, apart from the conversion to base64.
      'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjMyLjEwNAAAAAAAAAAAAAAA//tQxAADB8AhSmxhIIEVCSiJrDCQBTcu3UrAIwUdkRgQbFAZC1CQEwTJ9mjRvBA4UOLD8nKVOWfh+UlK3z/177OXrfOdKl7pyn3Xf//WreyTRUoAWgBgkOAGbZHBgG1OF6zM82DWbZaUmMBptgQhGjsyYqc9ae9XFz280948NMBWInljyzsNRFLPWdnZGWrddDsjK1unuSrVN9jJsK8KuQtQCtMBjCEtImISdNKJOopIpBFpNSMbIHCSRpRR5iakjTiyzLhchUUBwCgyKiweBv/7UsQbg8isVNoMPMjAAAA0gAAABEVFGmgqK////9bP/6XCykxBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq'
    );
    this.setBellSound(props.bell, props.bellSound);

    // The parent element for the terminal is attached and removed manually so
    // that we can preserve it across mounts and unmounts of the component
    this.termRef = props.term ? props.term.element!.parentElement! : document.createElement('div');
    this.termRef.className = 'term_fit term_term';

    this.termWrapperRef?.appendChild(this.termRef);

    if (!props.term) {
      const needTransparency = Color(props.backgroundColor).alpha() < 1;
      let useWebGL = false;
      if (props.webGLRenderer) {
        if (needTransparency) {
          console.warn(
            'WebGL Renderer has been disabled since it does not support transparent backgrounds yet. ' +
              'Falling back to canvas-based rendering.'
          );
        } else if (!isWebgl2Supported()) {
          console.warn('WebGL2 is not supported on your machine. Falling back to canvas-based rendering.');
        } else {
          // Experimental WebGL renderer needs some more glue-code to make it work on Hyper.
          // If you're working on enabling back WebGL, you will also need to look into `xterm-addon-ligatures` support for that renderer.
          useWebGL = true;
        }
      }
      Term.reportRenderer(props.uid, useWebGL ? 'WebGL' : 'Canvas');

      const shallActivateWebLink = (event: MouseEvent): boolean => {
        if (!event) return false;
        return props.webLinksActivationKey ? event[`${props.webLinksActivationKey}Key`] : true;
      };

      // eslint-disable-next-line @typescript-eslint/unbound-method
      this.term.attachCustomKeyEventHandler(this.keyboardHandler);
      this.term.loadAddon(this.fitAddon);
      this.term.loadAddon(this.searchAddon);
      this.term.loadAddon(
        new WebLinksAddon((event, uri) => {
          if (shallActivateWebLink(event)) void shell.openExternal(uri);
        })
      );
      this.term.open(this.termRef);

      if (useWebGL) {
        const webglAddon = new WebglAddon();
        this.term.loadAddon(webglAddon);
        webglAddon.onContextLoss(() => {
          console.warn('WebGL context lost. Falling back to canvas-based rendering.');
          webglAddon.dispose();
          this.term.loadAddon(new CanvasAddon());
        });
      } else {
        this.term.loadAddon(new CanvasAddon());
      }

      if (props.disableLigatures !== true && !useWebGL) {
        this.term.loadAddon(new LigaturesAddon());
      }

      this.term.loadAddon(new Unicode11Addon());
      this.term.unicode.activeVersion = '11';

      if (props.imageSupport) {
        this.term.loadAddon(new ImageAddon());
      }
    } else {
      // get the cached plugins
      this.fitAddon = props.fitAddon!;
      this.searchAddon = props.searchAddon!;
    }

    try {
      this.term.element!.style.padding = props.padding;
    } catch (error) {
      console.log(error);
    }

    this.fitAddon.fit();

    if (this.props.isTermActive) {
      this.term.focus();
    }

    if (props.onTitle) {
      this.disposableListeners.push(this.term.onTitleChange(props.onTitle));
    }

    if (props.onActive) {
      this.term.textarea?.addEventListener('focus', props.onActive);
      this.disposableListeners.push({
        dispose: () => this.term.textarea?.removeEventListener('focus', this.props.onActive)
      });
    }

    if (props.onData) {
      this.disposableListeners.push(this.term.onData(props.onData));
    }

    this.term.onBell(() => {
      this.ringBell();
    });

    if (props.onResize) {
      this.disposableListeners.push(
        this.term.onResize(({cols, rows}) => {
          props.onResize(cols, rows);
        })
      );

      // the row and col of init session is null, so reize the node-pty
      props.onResize(this.term.cols, this.term.rows);
    }

    if (props.onCursorMove || true) {
      this.disposableListeners.push(
        this.term.onCursorMove(() => {
          try {
            const cursorFrame = {
              x: this.term.buffer.active.cursorX * (this.term as any)._core._renderService.dimensions.actualCellWidth,
              y: this.term.buffer.active.cursorY * (this.term as any)._core._renderService.dimensions.actualCellHeight,
              width: (this.term as any)._core._renderService.dimensions.actualCellWidth,
              height: (this.term as any)._core._renderService.dimensions.actualCellHeight,
              col: this.term.buffer.active.cursorX,
              row: this.term.buffer.active.cursorY
            };
            
            // 更新光标位置状态，确保始终调用setState
            this.setState({ cursorPosition: cursorFrame });
            console.log('光标位置更新:', cursorFrame);
            
            // 如果有回调，也调用它
            if (props.onCursorMove) {
              props.onCursorMove(cursorFrame);
            }
          } catch (error) {
            console.error('更新光标位置时出错:', error);
          }
        })
      );
    }

    this.disposableListeners.push(
      this.searchAddon.onDidChangeResults((results) => {
        this.setState((state) => ({
          ...state,
          searchResults: results
        }));
      })
    );

    window.addEventListener('paste', this.onWindowPaste, {
      capture: true
    });

    terms[this.props.uid] = this;

    // 在终端的键盘事件中添加 AI 模式切换和处理逻辑
    this.term.onKey(async (e) => {
      // 切换 AI 模式 (Ctrl+Space 或 Alt+Space)
      if ((e.domEvent.ctrlKey || e.domEvent.altKey) && e.domEvent.code === 'Space') {
        e.domEvent.preventDefault();
        this.toggleAIMode();
        return;
      }

      // 在 AI 模式下处理回车键
      if (this.state.aiMode && e.domEvent.key === 'Enter' && !this.state.isProcessingAI) {
        const currentLine = this.getCurrentInputLine();
        if (currentLine.trim()) {
          e.domEvent.preventDefault(); // 阻止默认回车行为
          
          // 写入一个新行，表示命令已提交
          this.term.write('\r\n');
          
          // 处理 AI 命令
          await this.processAICommand(currentLine);
        }
      }
    });

    // 监听数据输入，用于跟踪当前输入行
    this.term.onData((data) => {
      // 只在 AI 模式下追踪输入
      if (this.state.aiMode) {
        // 处理退格键
        if (data === '\b' || data === '\x7f') {
          if (this.currentInputLine.length > 0) {
            // 删除一个字符
            this.currentInputLine = this.currentInputLine.slice(0, -1);
            // 视觉反馈：删除最后一个字符
            this.term.write('\b \b');
          }
        } 
        // 处理回车键（在onKey中单独处理）
        else if (data === '\r') {
          // 不做任何处理，由onKey处理
        }
        // 处理其他输入
        else if (data.length === 1 && !data.match(/[\r\n]/)) {
          this.currentInputLine += data;
          // 直接回显字符
          this.term.write(data);
        }
      }
    });
  }

  getTermDocument() {
    console.warn(
      'The underlying terminal engine of Hyper no longer ' +
        'uses iframes with individual `document` objects for each ' +
        'terminal instance. This method call is retained for ' +
        "backwards compatibility reasons. It's ok to attach directly" +
        'to the `document` object of the main `window`.'
    );
    return document;
  }

  // intercepting paste event for any necessary processing of
  // clipboard data, if result is falsy, paste event continues
  onWindowPaste = (e: Event) => {
    if (!this.props.isTermActive) return;

    const processed = processClipboard();
    if (processed) {
      e.preventDefault();
      e.stopPropagation();
      this.term.paste(processed);
    }
  };

  onMouseUp = (e: React.MouseEvent) => {
    if (this.props.quickEdit && e.button === 2) {
      if (this.term.hasSelection()) {
        clipboard.writeText(this.term.getSelection());
        this.term.clearSelection();
      } else {
        document.execCommand('paste');
      }
    } else if (this.props.copyOnSelect && this.term.hasSelection()) {
      clipboard.writeText(this.term.getSelection());
    }
  };

  write(data: string | Uint8Array) {
    this.term.write(data);
  }

  focus = () => {
    this.term.focus();
  };

  clear() {
    this.term.clear();
  }

  reset() {
    this.term.reset();
  }

  searchNext = (searchTerm: string) => {
    this.searchAddon.findNext(searchTerm, {
      ...this.state.searchOptions,
      decorations: this.searchDecorations
    });
  };

  searchPrevious = (searchTerm: string) => {
    this.searchAddon.findPrevious(searchTerm, {
      ...this.state.searchOptions,
      decorations: this.searchDecorations
    });
  };

  closeSearchBox = () => {
    this.props.onCloseSearch();
    this.searchAddon.clearDecorations();
    this.searchAddon.clearActiveDecoration();
    this.setState((state) => ({
      ...state,
      searchResults: undefined
    }));
    this.term.focus();
  };

  resize(cols: number, rows: number) {
    this.term.resize(cols, rows);
  }

  selectAll() {
    this.term.selectAll();
  }

  fitResize() {
    if (!this.termWrapperRef) {
      return;
    }
    this.fitAddon.fit();
  }

  keyboardHandler(e: any) {
    // Has Mousetrap flagged this event as a command?
    return !e.catched;
  }

  setBellSound(bell: 'SOUND' | false, sound: string | null) {
    if (bell && bell.toUpperCase() === 'SOUND') {
      this.bellSound = sound ? new Audio(sound) : this.defaultBellSound;
    } else {
      this.bellSound = null;
    }
  }

  ringBell() {
    void this.bellSound?.play();
  }

  componentDidUpdate(prevProps: TermProps) {
    if (!prevProps.cleared && this.props.cleared) {
      this.clear();
    }

    const nextTermOptions = getTermOptions(this.props);

    if (prevProps.bell !== this.props.bell || prevProps.bellSound !== this.props.bellSound) {
      this.setBellSound(this.props.bell, this.props.bellSound);
    }

    if (prevProps.search && !this.props.search) {
      this.closeSearchBox();
    }

    // Update only options that have changed.
    this.term.options = pickBy(
      nextTermOptions,
      (value, key) => !isEqual(this.termOptions[key as keyof ITerminalOptions], value)
    );

    this.termOptions = nextTermOptions;

    try {
      this.term.element!.style.padding = this.props.padding;
    } catch (error) {
      console.log(error);
    }

    if (
      this.props.fontSize !== prevProps.fontSize ||
      this.props.fontFamily !== prevProps.fontFamily ||
      this.props.lineHeight !== prevProps.lineHeight ||
      this.props.letterSpacing !== prevProps.letterSpacing
    ) {
      // resize to fit the container
      this.fitResize();
    }

    if (prevProps.rows !== this.props.rows || prevProps.cols !== this.props.cols) {
      this.resize(this.props.cols!, this.props.rows!);
    }
  }

  onTermWrapperRef = (component: HTMLElement | null) => {
    this.termWrapperRef = component;

    if (component) {
      this.resizeObserver = new ResizeObserver(() => {
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(() => {
          this.fitResize();
        }, 500);
      });
      this.resizeObserver.observe(component);
    } else {
      this.resizeObserver.disconnect();
    }
  };

  componentWillUnmount() {
    terms[this.props.uid] = null;
    this.termWrapperRef?.removeChild(this.termRef!);
    this.props.ref_(this.props.uid, null);

    // to clean up the terminal, we remove the listeners
    // instead of invoking `destroy`, since it will make the
    // term insta un-attachable in the future (which we need
    // to do in case of splitting, see `componentDidMount`
    this.disposableListeners.forEach((handler) => handler.dispose());
    this.disposableListeners = [];

    window.removeEventListener('paste', this.onWindowPaste, {
      capture: true
    });
  }

  // 处理命令处理
  handleCommand = (command: string) => {
    if (command && this.term) {
      this.term.write(command);
      setTimeout(() => {
        this.term.write('\n');
      }, 100);
    }
  };

  /**
   * 切换 AI 模式
   */
  toggleAIMode = () => {
    this.setState((prevState) => {
      const newAIMode = !prevState.aiMode;
      
      // 更新状态
      if (newAIMode) {
        // 清空输入行
        this.currentInputLine = '';
        
        // 显示欢迎消息
        this.term.write(AI_MODE_ENABLED_MESSAGE);
        
        // 提示用户输入
        this.term.write(AI_PROMPT);
      } else {
        this.term.write(AI_MODE_DISABLED_MESSAGE);
      }
      
      return { aiMode: newAIMode };
    });
  };

  /**
   * 获取当前输入行的文本
   */
  getCurrentInputLine = (): string => {
    // 使用我们追踪的输入行
    return this.currentInputLine;
  };

  /**
   * 处理 AI 命令生成
   */
  processAICommand = async (input: string) => {
    if (!input.trim() || this.state.isProcessingAI) return;

    this.setState({ isProcessingAI: true });
    
    // 清空当前输入行
    this.currentInputLine = '';
    
    try {
      // 显示处理中的消息
      this.term.write(AI_PROCESSING_MESSAGE);
      
      // 调用终端智能体
      const response = await callTerminalAgentWithContext(input, this.aiThreadId);
      
      // 解析生成的命令
      const command = parseCommandForExecution(response);
      
      if (command) {
        // 显示找到的命令，使用明显的格式
        this.term.write(`\r\n\x1b[42m\x1b[30m 找到命令 \x1b[0m \x1b[32m${command}\x1b[0m`);
        
        // 询问是否执行
        this.term.write('\r\n\x1b[33m是否执行此命令? (y/n): \x1b[0m');
        
        // 设置一次性监听器来处理用户确认
        const confirmHandler = this.term.onData((data) => {
          if (data.toLowerCase() === 'y') {
            // 执行命令
            this.term.write(`\r\n\x1b[32m执行命令: ${command}\x1b[0m\r\n`);
            this.term.write(command);
            this.term.write('\r\n');
            
            // 移除监听器
            confirmHandler.dispose();
          } else if (data.toLowerCase() === 'n') {
            this.term.write('\r\n\x1b[33m命令已取消\x1b[0m\r\n');
            
            // 移除监听器
            confirmHandler.dispose();
            
            // 重新提示用户输入
            this.term.write(AI_PROMPT);
          } else {
            return; // 忽略其他输入
          }
        });
      } else {
        // 没有找到有效命令，显示完整的 AI 响应
        this.term.write(`\r\n\x1b[33m[AI回答]:\r\n${response}\x1b[0m\r\n`);
        
        // 重新提示用户输入
        this.term.write(AI_PROMPT);
      }
    } catch (error) {
      // 显示错误信息
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.term.write(`${AI_ERROR_MESSAGE}${errorMessage}\x1b[0m\r\n`);
      
      // 重新提示用户输入
      this.term.write(AI_PROMPT);
    } finally {
      this.setState({ isProcessingAI: false });
    }
  };

  render() {
    return (
      <div className={`term_fit ${this.props.isTermActive ? 'term_active' : ''}`} onMouseUp={this.onMouseUp}>
        {this.props.customChildrenBefore}
        <div ref={this.onTermWrapperRef} className="term_fit term_wrapper" />
        {this.props.customChildren}
        
        {this.props.search ? (
          <SearchBox
            next={this.searchNext}
            prev={this.searchPrevious}
            close={this.closeSearchBox}
            caseSensitive={this.state.searchOptions.caseSensitive}
            wholeWord={this.state.searchOptions.wholeWord}
            regex={this.state.searchOptions.regex}
            results={this.state.searchResults}
            toggleCaseSensitive={() =>
              this.setState({
                ...this.state,
                searchOptions: {...this.state.searchOptions, caseSensitive: !this.state.searchOptions.caseSensitive}
              })
            }
            toggleWholeWord={() =>
              this.setState({
                ...this.state,
                searchOptions: {...this.state.searchOptions, wholeWord: !this.state.searchOptions.wholeWord}
              })
            }
            toggleRegex={() =>
              this.setState({
                ...this.state,
                searchOptions: {...this.state.searchOptions, regex: !this.state.searchOptions.regex}
              })
            }
            selectionColor={this.props.selectionColor}
            backgroundColor={this.props.backgroundColor}
            foregroundColor={this.props.foregroundColor}
            borderColor={this.props.borderColor}
            font={this.props.uiFontFamily}
          />
        ) : null}

        {/* 浮动AI工具栏 */}
        <div className="ai-floating-toolbar">
          {this.state.aiMode && (
            <div className="ai-status-badge">
              <span className="ai-badge-text">AI模式已启用</span>
              {this.state.isProcessingAI && (
                <div className="ai-loading-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              )}
            </div>
          )}
          
          <div className="ai-toolbar-buttons">
            <button 
              className={`ai-toggle-button ${this.state.aiMode ? 'active' : ''}`} 
              onClick={this.toggleAIMode}
              title={`${this.state.aiMode ? '关闭' : '打开'}AI模式 (${AI_MODE_SHORTCUT})`}
            >
              <span className="button-icon">🤖</span>
              <span className="button-text">AI{this.state.aiMode ? ' 开启' : ''}</span>
            </button>
            
            {this.state.aiMode && (
              <>
                <button className="ai-tool-button" title="解释 (Ctrl+1)">
                  <span className="button-icon">📖</span>
                  <span className="button-text">解释</span>
                </button>
                <button className="ai-tool-button" title="修复 (Ctrl+2)">
                  <span className="button-icon">🔧</span>
                  <span className="button-text">修复</span>
                </button>
              </>
            )}
          </div>
        </div>

        <style jsx global>{`
          .term_fit {
            display: block;
            width: 100%;
            height: 100%;
            position: relative;
          }

          .term_wrapper {
            overflow: hidden;
          }
          
          /* 浮动AI工具栏 */
          .ai-floating-toolbar {
            position: absolute;
            bottom: 20px;
            right: 20px;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 10px;
            z-index: 999;
          }
          
          .ai-status-badge {
            display: flex;
            align-items: center;
            background-color: rgba(65, 105, 225, 0.7);
            color: white;
            padding: 5px 10px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            margin-bottom: 5px;
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
          }
          
          .ai-badge-text {
            margin-right: 5px;
          }
          
          .ai-toolbar-buttons {
            display: flex;
            gap: 8px;
          }
          
          .ai-toggle-button, .ai-tool-button {
            display: flex;
            align-items: center;
            background-color: rgba(40, 40, 40, 0.75);
            color: #ccc;
            border: none;
            border-radius: 4px;
            padding: 5px 10px;
            cursor: pointer;
            font-size: 12px;
            transition: all 0.2s ease;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          }
          
          .ai-toggle-button:hover, .ai-tool-button:hover {
            background-color: rgba(60, 60, 60, 0.85);
            color: white;
          }
          
          .ai-toggle-button.active {
            background-color: rgba(65, 105, 225, 0.75);
            color: white;
          }
          
          .button-icon {
            margin-right: 5px;
          }
          
          .ai-loading-dots {
            display: flex;
            gap: 3px;
            margin-left: 5px;
          }
          
          .ai-loading-dots span {
            width: 4px;
            height: 4px;
            border-radius: 50%;
            background-color: white;
            animation: dot-pulse 1.5s infinite;
          }
          
          .ai-loading-dots span:nth-child(2) {
            animation-delay: 0.2s;
          }
          
          .ai-loading-dots span:nth-child(3) {
            animation-delay: 0.4s;
          }
          
          @keyframes dot-pulse {
            0%, 100% { opacity: 0.4; transform: scale(0.8); }
            50% { opacity: 1; transform: scale(1.1); }
          }
        `}</style>
      </div>
    );
  }
}
