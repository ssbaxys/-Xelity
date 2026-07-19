import {
  File,
  FileCode,
  FileCog,
  FileImage,
  FileJson,
  FileText,
  Folder,
  FolderOpen,
  Loader2,
} from 'lucide-react';
import {
  AnimatePresence,
  motion,
  type Transition,
  useReducedMotion,
} from 'motion/react';
import * as React from 'react';
import { cn } from '@/utils/cn';

const DEFAULT_HIGHLIGHT_COLOR = 'var(--color-signal, #c62828)';

const instantTransition: Transition = { duration: 0 };

type HighlightBounds = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type RegisteredNode = {
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  disabled: boolean;
  isBranch: boolean;
  label: string;
  level: number;
  nodeId: string;
  parentId: string | null;
  rowRef: React.RefObject<HTMLDivElement | null>;
  siblingIndex: number;
  siblingCount: number;
};

type SiblingMeta = { index: number; count: number };

type FileTreeContextValue = {
  containerRef: React.RefObject<HTMLDivElement | null>;
  collapseAll: () => void;
  expandAll: () => void;
  expandedIds: Set<string>;
  focusNode: (nodeId: string) => void;
  focusedNodeId: string | null;
  getVisibleNodeIds: () => string[];
  highlightBounds: HighlightBounds | null;
  highlightColor: string;
  iconMap: Record<string, React.ComponentType<{ className?: string }>>;
  indentSize: number;
  isNodeVisible: (nodeId: string) => boolean;
  moveFocus: (direction: 'first' | 'last' | 'next' | 'previous') => void;
  onItemKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
  onLoadChildren?: (nodeId: string) => void;
  onNodeClick?: (nodeId: string, event?: React.MouseEvent) => void;
  onNodeExpand?: (nodeId: string, expanded: boolean) => void;
  reduceMotion: boolean;
  registerNode: (node: RegisteredNode) => void;
  registryVersion: number;
  searchQuery: string;
  selectNode: (
    nodeId: string,
    options?: { additive?: boolean; range?: boolean },
  ) => void;
  selectedIds: Set<string>;
  selectionMode: 'multiple' | 'single';
  setFocusedNodeId: React.Dispatch<React.SetStateAction<string | null>>;
  setHighlightBounds: React.Dispatch<
    React.SetStateAction<HighlightBounds | null>
  >;
  setHighlightFromElement: (element: HTMLElement | null) => void;
  showIcons: boolean;
  toggleExpanded: (nodeId: string, expanded?: boolean) => void;
  truncate: boolean;
  unregisterNode: (nodeId: string) => void;
};

type BranchContextValue = {
  level: number;
  parentId: string | null;
};

const FileTreeContext = React.createContext<FileTreeContextValue | null>(null);
const BranchContext = React.createContext<BranchContextValue>({
  level: 1,
  parentId: null,
});
const SiblingMetaContext = React.createContext<SiblingMeta>({
  index: 0,
  count: 1,
});

const DEFAULT_EXT_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  tsx: FileCode,
  ts: FileCode,
  jsx: FileCode,
  js: FileCode,
  mjs: FileCode,
  cjs: FileCode,
  json: FileJson,
  md: FileText,
  mdx: FileText,
  txt: FileText,
  html: FileCode,
  htm: FileCode,
  png: FileImage,
  jpg: FileImage,
  jpeg: FileImage,
  svg: FileImage,
  webp: FileImage,
  gif: FileImage,
  css: FileCode,
  scss: FileCode,
  config: FileCog,
  toml: FileCog,
  yaml: FileCog,
  yml: FileCog,
  env: FileCog,
};

const FILENAME_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  dockerfile: FileCog,
  makefile: FileCog,
  '.env': FileCog,
  '.gitignore': FileCog,
};

function useFileTree() {
  const context = React.useContext(FileTreeContext);
  if (!context) {
    throw new Error('File tree components must be used within <FileTree />');
  }
  return context;
}

function normalizeIds(ids?: string[] | Set<string>) {
  if (!ids) return new Set<string>();
  return ids instanceof Set ? ids : new Set(ids);
}

function setsEqual(left: Set<string>, right: Set<string>) {
  if (left.size !== right.size) return false;
  for (const value of left) {
    if (!right.has(value)) return false;
  }
  return true;
}

function resolveFileIcon(
  label: string,
  iconMap: Record<string, React.ComponentType<{ className?: string }>>,
) {
  const normalizedLabel = label.toLowerCase();
  if (FILENAME_ICONS[normalizedLabel]) return FILENAME_ICONS[normalizedLabel];
  if (normalizedLabel.startsWith('.')) {
    const extensionless = normalizedLabel.slice(1);
    if (iconMap[extensionless]) return iconMap[extensionless];
  }
  const segments = label.split('.');
  if (segments.length > 2) {
    const compound = segments.slice(-2).join('.').toLowerCase();
    if (iconMap[compound]) return iconMap[compound];
  }
  const extension = segments.pop()?.toLowerCase() ?? '';
  return iconMap[extension] ?? File;
}

function matchesSearch(label: string, query: string) {
  return label.toLowerCase().includes(query.trim().toLowerCase());
}

function buildChildMap(nodes: Map<string, RegisteredNode>) {
  const childMap = new Map<string | null, RegisteredNode[]>();
  for (const node of nodes.values()) {
    const siblings = childMap.get(node.parentId) ?? [];
    siblings.push(node);
    childMap.set(node.parentId, siblings);
  }
  for (const siblings of childMap.values()) {
    siblings.sort((a, b) => a.siblingIndex - b.siblingIndex);
  }
  return childMap;
}

function collectMatchingNodeIds(
  childMap: Map<string | null, RegisteredNode[]>,
  query: string,
) {
  const matching = new Set<string>();
  const visit = (node: RegisteredNode): boolean => {
    const children = childMap.get(node.nodeId) ?? [];
    const childMatches = children.map(visit);
    const selfMatches = matchesSearch(node.label, query);
    const hasMatch = selfMatches || childMatches.some(Boolean);
    if (hasMatch) matching.add(node.nodeId);
    return hasMatch;
  };
  for (const node of childMap.get(null) ?? []) visit(node);
  return matching;
}

function getVisibleNodeIdsFromRegistry(
  nodes: Map<string, RegisteredNode>,
  expandedIds: Set<string>,
  searchQuery: string,
) {
  const childMap = buildChildMap(nodes);
  const trimmedSearch = searchQuery.trim();
  const matchingIds = trimmedSearch
    ? collectMatchingNodeIds(childMap, trimmedSearch)
    : null;
  const visible: string[] = [];
  const visit = (node: RegisteredNode) => {
    if (matchingIds && !matchingIds.has(node.nodeId)) return;
    visible.push(node.nodeId);
    if (!(node.isBranch && expandedIds.has(node.nodeId))) return;
    for (const child of childMap.get(node.nodeId) ?? []) visit(child);
  };
  for (const node of childMap.get(null) ?? []) visit(node);
  return visible;
}

function resolveSelectionUpdate(
  previous: Set<string>,
  nodeId: string,
  visibleIds: string[],
  focusedNodeId: string | null,
  selectionMode: 'multiple' | 'single',
  options?: { additive?: boolean; range?: boolean },
) {
  if (selectionMode === 'single') return new Set([nodeId]);
  const next = new Set(previous);
  if (options?.range && focusedNodeId) {
    const start = visibleIds.indexOf(focusedNodeId);
    const end = visibleIds.indexOf(nodeId);
    if (start !== -1 && end !== -1) {
      const [from, to] = start < end ? [start, end] : [end, start];
      for (const id of visibleIds.slice(from, to + 1)) next.add(id);
      return next;
    }
  }
  if (options?.additive) {
    if (next.has(nodeId)) next.delete(nodeId);
    else next.add(nodeId);
    return next;
  }
  return new Set([nodeId]);
}

function expandSearchBranches(
  nodes: Map<string, RegisteredNode>,
  searchQuery: string,
) {
  const trimmedSearch = searchQuery.trim();
  if (!trimmedSearch) return [];
  const childMap = buildChildMap(nodes);
  const matchingIds = collectMatchingNodeIds(childMap, trimmedSearch);
  return [...matchingIds].filter((nodeId) => nodes.get(nodeId)?.isBranch);
}

type TreeItemKeyContext = {
  currentNode: RegisteredNode | undefined;
  expandedIds: Set<string>;
  focusNode: (nodeId: string) => void;
  moveFocus: (direction: 'first' | 'last' | 'next' | 'previous') => void;
  nodes: Map<string, RegisteredNode>;
  setExpandedIds: (updater: (previous: Set<string>) => Set<string>) => void;
  toggleExpanded: (nodeId: string, expanded?: boolean) => void;
};

function handleTreeItemKeyDown(
  event: React.KeyboardEvent<HTMLButtonElement>,
  context: TreeItemKeyContext,
) {
  const { currentNode, moveFocus, toggleExpanded, focusNode, expandedIds } =
    context;
  if (!currentNode) {
    if (event.key === 'ArrowDown' || event.key === 'Home') {
      event.preventDefault();
      moveFocus(event.key === 'Home' ? 'first' : 'next');
    }
    return;
  }
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      moveFocus('next');
      break;
    case 'ArrowUp':
      event.preventDefault();
      moveFocus('previous');
      break;
    case 'ArrowRight':
      event.preventDefault();
      if (currentNode.isBranch) {
        if (expandedIds.has(currentNode.nodeId)) moveFocus('next');
        else toggleExpanded(currentNode.nodeId, true);
      }
      break;
    case 'ArrowLeft':
      event.preventDefault();
      if (currentNode.isBranch && expandedIds.has(currentNode.nodeId)) {
        toggleExpanded(currentNode.nodeId, false);
      } else if (currentNode.parentId) {
        focusNode(currentNode.parentId);
      }
      break;
    case 'Home':
      event.preventDefault();
      moveFocus('first');
      break;
    case 'End':
      event.preventDefault();
      moveFocus('last');
      break;
    case '*':
      event.preventDefault();
      if (currentNode.parentId) {
        context.setExpandedIds((previous) => {
          const next = new Set(previous);
          for (const node of context.nodes.values()) {
            if (node.parentId === currentNode.parentId && node.isBranch) {
              next.add(node.nodeId);
            }
          }
          return next;
        });
      }
      break;
    default:
      break;
  }
}

function FileTreeHoverHighlight({
  className,
  reduceMotion,
}: {
  className?: string;
  reduceMotion: boolean;
}) {
  const { highlightBounds } = useFileTree();
  return (
    <AnimatePresence>
      {highlightBounds && (
        <motion.div
          animate={{
            opacity: 1,
            top: highlightBounds.top,
            left: highlightBounds.left,
            width: highlightBounds.width,
            height: highlightBounds.height,
          }}
          className={className}
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          style={{ position: 'absolute', pointerEvents: 'none', zIndex: 0 }}
          transition={
            reduceMotion
              ? instantTransition
              : { type: 'spring', stiffness: 500, damping: 40 }
          }
        />
      )}
    </AnimatePresence>
  );
}

function useHighlightTarget() {
  const { setHighlightFromElement } = useFileTree();
  const ref = React.useRef<HTMLDivElement>(null);
  const updateHighlight = React.useCallback(() => {
    setHighlightFromElement(ref.current);
  }, [setHighlightFromElement]);
  return { ref, onFocus: updateHighlight, onMouseEnter: updateHighlight };
}

function FolderIcon({
  closeIcon,
  openIcon,
  isOpen,
  reduceMotion,
}: {
  closeIcon: React.ReactNode;
  isOpen: boolean;
  openIcon: React.ReactNode;
  reduceMotion: boolean;
}) {
  if (reduceMotion) {
    return (
      <span className="xft-icon-slot">{isOpen ? openIcon : closeIcon}</span>
    );
  }
  return (
    <span className="xft-icon-slot xft-icon-slot--anim">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          className="inline-flex"
          exit={{ scale: 0.5, opacity: 0, rotate: 15 }}
          initial={{ scale: 0.5, opacity: 0, rotate: -15 }}
          key={isOpen ? 'open' : 'close'}
          transition={{
            type: 'spring',
            stiffness: 500,
            damping: 30,
            mass: 0.8,
          }}
        >
          {isOpen ? openIcon : closeIcon}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function FolderContent({
  children,
  isOpen,
  reduceMotion,
}: {
  children: React.ReactNode;
  isOpen: boolean;
  reduceMotion: boolean;
}) {
  if (reduceMotion) return isOpen ? <div>{children}</div> : null;
  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          initial={{ height: 0, opacity: 0 }}
          style={{ overflow: 'hidden' }}
          transition={{ type: 'spring', stiffness: 500, damping: 40 }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function FileTreeRowContent({
  highlight,
  icon,
  isBranch,
  isOpen,
  label,
  loading,
  openIcon,
  truncate,
}: {
  highlight?: boolean;
  icon?: React.ReactNode;
  isBranch: boolean;
  isOpen: boolean;
  label: string;
  loading?: boolean;
  openIcon?: React.ReactNode;
  truncate?: boolean;
}) {
  const { highlightColor, iconMap, reduceMotion, showIcons } = useFileTree();
  const renderedIcon = loading ? (
    <Loader2 className="xft-lucide xft-spin" />
  ) : isBranch ? (
    <FolderIcon
      closeIcon={icon ?? <Folder className="xft-lucide xft-folder" />}
      isOpen={isOpen}
      openIcon={openIcon ?? <FolderOpen className="xft-lucide xft-folder-open" />}
      reduceMotion={reduceMotion}
    />
  ) : (
    (icon ??
      React.createElement(resolveFileIcon(label, iconMap), {
        className: 'xft-lucide xft-file',
      }))
  );

  return (
    <div className="xft-row-inner">
      {showIcons && <span className="xft-icon">{renderedIcon}</span>}
      <span
        className={cn('xft-label', truncate && 'truncate')}
        style={highlight ? { color: highlightColor } : undefined}
        title={truncate ? label : undefined}
      >
        {label}
      </span>
    </div>
  );
}

function BranchSiblingProvider({ children }: { children: React.ReactNode }) {
  const childArray = React.Children.toArray(children).filter(Boolean);
  const count = childArray.length;
  return (
    <>
      {childArray.map((child, index) => (
        <SiblingMetaContext.Provider
          key={
            typeof child === 'object' && child && 'key' in child
              ? String(child.key)
              : index
          }
          value={{ index, count }}
        >
          {child}
        </SiblingMetaContext.Provider>
      ))}
    </>
  );
}

export type FileTreeHandle = {
  collapseAll: () => void;
  expandAll: () => void;
  focusNode: (nodeId: string) => void;
};

export type FileTreeNodeData = {
  children?: FileTreeNodeData[];
  disabled?: boolean;
  hasChildren?: boolean;
  highlight?: boolean;
  icon?: React.ReactNode;
  id: string;
  label: string;
  loading?: boolean;
  openIcon?: React.ReactNode;
};

export type FileTreeProps = Omit<
  React.ComponentProps<'div'>,
  'onDragStart'
> & {
  defaultExpandedIds?: string[];
  defaultSelectedId?: string;
  defaultSelectedIds?: string[];
  expandedIds?: string[] | Set<string>;
  highlightColor?: string;
  iconMap?: Record<string, React.ComponentType<{ className?: string }>>;
  indentSize?: number;
  maxHeight?: number | string;
  onExpandedIdsChange?: (expandedIds: string[]) => void;
  onLoadChildren?: (nodeId: string) => void;
  onNodeClick?: (nodeId: string, event?: React.MouseEvent) => void;
  onNodeExpand?: (nodeId: string, expanded: boolean) => void;
  onSelectedIdsChange?: (selectedIds: string[]) => void;
  searchQuery?: string;
  selectedIds?: string[] | Set<string>;
  selectionMode?: 'multiple' | 'single';
  showIcons?: boolean;
  truncate?: boolean;
};

export const FileTree = React.forwardRef<FileTreeHandle, FileTreeProps>(
  function FileTree(
    {
      className,
      children,
      defaultExpandedIds = [],
      defaultSelectedId,
      defaultSelectedIds = [],
      expandedIds: expandedIdsProp,
      highlightColor = DEFAULT_HIGHLIGHT_COLOR,
      iconMap,
      indentSize = 16,
      maxHeight,
      onExpandedIdsChange,
      onLoadChildren,
      onNodeClick,
      onNodeExpand,
      onSelectedIdsChange,
      searchQuery = '',
      selectedIds: selectedIdsProp,
      selectionMode = 'single',
      showIcons = true,
      truncate = true,
      ...props
    },
    ref,
  ) {
    const reduceMotion = useReducedMotion() === true;
    const containerRef = React.useRef<HTMLDivElement>(null);
    const nodesRef = React.useRef(new Map<string, RegisteredNode>());
    const warnedDuplicateIdsRef = React.useRef(new Set<string>());
    const registryFlushRef = React.useRef<number | null>(null);
    const [highlightBounds, setHighlightBounds] =
      React.useState<HighlightBounds | null>(null);
    const [focusedNodeId, setFocusedNodeId] = React.useState<string | null>(
      null,
    );
    const [registryVersion, setRegistryVersion] = React.useState(0);

    const isExpandedControlled = expandedIdsProp !== undefined;
    const [uncontrolledExpandedIds, setUncontrolledExpandedIds] =
      React.useState(() => normalizeIds(defaultExpandedIds));
    const expandedIds = isExpandedControlled
      ? normalizeIds(expandedIdsProp)
      : uncontrolledExpandedIds;

    const isSelectedControlled = selectedIdsProp !== undefined;
    const [uncontrolledSelectedIds, setUncontrolledSelectedIds] =
      React.useState(() => {
        const ids = new Set(defaultSelectedIds);
        if (defaultSelectedId) ids.add(defaultSelectedId);
        return ids;
      });
    const selectedIds = isSelectedControlled
      ? normalizeIds(selectedIdsProp)
      : uncontrolledSelectedIds;

    const mergedIconMap = React.useMemo(
      () => ({ ...DEFAULT_EXT_ICONS, ...iconMap }),
      [iconMap],
    );

    const scheduleRegistryFlush = React.useCallback(() => {
      if (registryFlushRef.current !== null) return;
      registryFlushRef.current = window.requestAnimationFrame(() => {
        registryFlushRef.current = null;
        setRegistryVersion((version) => version + 1);
      });
    }, []);

    React.useEffect(() => {
      return () => {
        if (registryFlushRef.current !== null) {
          window.cancelAnimationFrame(registryFlushRef.current);
        }
      };
    }, []);

    const setExpandedIds = React.useCallback(
      (updater: (previous: Set<string>) => Set<string>) => {
        if (isExpandedControlled) {
          const next = updater(expandedIds);
          if (!setsEqual(next, expandedIds)) onExpandedIdsChange?.([...next]);
          return;
        }
        setUncontrolledExpandedIds((previous) => {
          const next = updater(previous);
          if (!setsEqual(next, previous)) onExpandedIdsChange?.([...next]);
          return next;
        });
      },
      [expandedIds, isExpandedControlled, onExpandedIdsChange],
    );

    const setSelectedIds = React.useCallback(
      (updater: (previous: Set<string>) => Set<string>) => {
        if (isSelectedControlled) {
          const next = updater(selectedIds);
          if (!setsEqual(next, selectedIds)) onSelectedIdsChange?.([...next]);
          return;
        }
        setUncontrolledSelectedIds((previous) => {
          const next = updater(previous);
          if (!setsEqual(next, previous)) onSelectedIdsChange?.([...next]);
          return next;
        });
      },
      [isSelectedControlled, onSelectedIdsChange, selectedIds],
    );

    const setHighlightFromElement = React.useCallback(
      (element: HTMLElement | null) => {
        const container = containerRef.current;
        if (!(element && container)) return;
        const containerRect = container.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        setHighlightBounds({
          top: elementRect.top - containerRect.top + container.scrollTop,
          left: elementRect.left - containerRect.left + container.scrollLeft,
          width: elementRect.width,
          height: elementRect.height,
        });
      },
      [],
    );

    const registerNode = React.useCallback(
      (node: RegisteredNode) => {
        if (
          nodesRef.current.has(node.nodeId) &&
          !warnedDuplicateIdsRef.current.has(node.nodeId)
        ) {
          warnedDuplicateIdsRef.current.add(node.nodeId);
          console.warn(
            `[FileTree] Duplicate nodeId "${node.nodeId}". Each item needs a unique id.`,
          );
        }
        nodesRef.current.set(node.nodeId, node);
        scheduleRegistryFlush();
      },
      [scheduleRegistryFlush],
    );

    const unregisterNode = React.useCallback(
      (nodeId: string) => {
        nodesRef.current.delete(nodeId);
        scheduleRegistryFlush();
      },
      [scheduleRegistryFlush],
    );

    const visibleNodeIds = React.useMemo(() => {
      if (registryVersion < 0) return [];
      return getVisibleNodeIdsFromRegistry(
        nodesRef.current,
        expandedIds,
        searchQuery,
      );
    }, [expandedIds, registryVersion, searchQuery]);

    const getVisibleNodeIds = React.useCallback(
      () => visibleNodeIds,
      [visibleNodeIds],
    );

    const trimmedSearch = searchQuery.trim();

    React.useEffect(() => {
      if (!trimmedSearch || registryVersion < 0) return;
      const branchIds = expandSearchBranches(nodesRef.current, trimmedSearch);
      if (branchIds.length === 0) return;
      setExpandedIds((previous) => {
        const next = new Set(previous);
        let changed = false;
        for (const nodeId of branchIds) {
          if (!next.has(nodeId)) {
            next.add(nodeId);
            changed = true;
          }
        }
        return changed ? next : previous;
      });
    }, [registryVersion, setExpandedIds, trimmedSearch]);

    const isNodeVisible = React.useCallback(
      (nodeId: string) => {
        if (!trimmedSearch) return true;
        if (!nodesRef.current.has(nodeId)) return true;
        return visibleNodeIds.includes(nodeId);
      },
      [trimmedSearch, visibleNodeIds],
    );

    const toggleExpanded = React.useCallback(
      (nodeId: string, expanded?: boolean) => {
        setExpandedIds((previous) => {
          const next = new Set(previous);
          const isExpanded = next.has(nodeId);
          const shouldExpand = expanded ?? !isExpanded;
          if (shouldExpand) next.add(nodeId);
          else next.delete(nodeId);
          if (shouldExpand !== isExpanded) {
            onNodeExpand?.(nodeId, shouldExpand);
            if (shouldExpand) onLoadChildren?.(nodeId);
          }
          return next;
        });
      },
      [onLoadChildren, onNodeExpand, setExpandedIds],
    );

    const selectNode = React.useCallback(
      (nodeId: string, options?: { additive?: boolean; range?: boolean }) => {
        const visibleIds = getVisibleNodeIds();
        if (!visibleIds.includes(nodeId)) return;
        setSelectedIds((previous) =>
          resolveSelectionUpdate(
            previous,
            nodeId,
            visibleIds,
            focusedNodeId,
            selectionMode,
            options,
          ),
        );
      },
      [focusedNodeId, getVisibleNodeIds, selectionMode, setSelectedIds],
    );

    const focusNode = React.useCallback(
      (nodeId: string) => {
        const node = nodesRef.current.get(nodeId);
        if (!node || node.disabled) return;
        setFocusedNodeId(nodeId);
        node.buttonRef.current?.focus({ preventScroll: true });
        setHighlightFromElement(node.rowRef.current);
      },
      [setHighlightFromElement],
    );

    const moveFocus = React.useCallback(
      (direction: 'first' | 'last' | 'next' | 'previous') => {
        const visibleIds = getVisibleNodeIds().filter((nodeId) => {
          const node = nodesRef.current.get(nodeId);
          return node && !node.disabled;
        });
        if (visibleIds.length === 0) return;
        const currentIndex = focusedNodeId
          ? visibleIds.indexOf(focusedNodeId)
          : -1;
        let nextIndex = currentIndex;
        if (direction === 'first') nextIndex = 0;
        else if (direction === 'last') nextIndex = visibleIds.length - 1;
        else if (direction === 'next') {
          nextIndex =
            currentIndex === -1
              ? 0
              : Math.min(currentIndex + 1, visibleIds.length - 1);
        } else {
          nextIndex =
            currentIndex === -1
              ? visibleIds.length - 1
              : Math.max(currentIndex - 1, 0);
        }
        focusNode(visibleIds[nextIndex]!);
      },
      [focusNode, focusedNodeId, getVisibleNodeIds],
    );

    const expandAll = React.useCallback(() => {
      const branchIds = [...nodesRef.current.values()]
        .filter((node) => node.isBranch)
        .map((node) => node.nodeId);
      setExpandedIds((previous) => {
        const next = new Set(previous);
        for (const nodeId of branchIds) next.add(nodeId);
        return next;
      });
    }, [setExpandedIds]);

    const collapseAll = React.useCallback(() => {
      setExpandedIds(() => new Set());
    }, [setExpandedIds]);

    const onItemKeyDown = React.useCallback(
      (event: React.KeyboardEvent<HTMLButtonElement>) => {
        const visibleIds = getVisibleNodeIds();
        const currentId =
          focusedNodeId && visibleIds.includes(focusedNodeId)
            ? focusedNodeId
            : visibleIds[0];
        handleTreeItemKeyDown(event, {
          currentNode: currentId
            ? nodesRef.current.get(currentId)
            : undefined,
          expandedIds,
          focusNode,
          moveFocus,
          nodes: nodesRef.current,
          setExpandedIds,
          toggleExpanded,
        });
      },
      [
        expandedIds,
        focusNode,
        focusedNodeId,
        getVisibleNodeIds,
        moveFocus,
        setExpandedIds,
        toggleExpanded,
      ],
    );

    const handleContainerScroll = React.useCallback(() => {
      if (!focusedNodeId) return;
      const node = nodesRef.current.get(focusedNodeId);
      if (node?.rowRef.current) setHighlightFromElement(node.rowRef.current);
    }, [focusedNodeId, setHighlightFromElement]);

    React.useImperativeHandle(
      ref,
      () => ({ collapseAll, expandAll, focusNode }),
      [collapseAll, expandAll, focusNode],
    );

    const contextValue = React.useMemo<FileTreeContextValue>(
      () => ({
        containerRef,
        collapseAll,
        expandAll,
        expandedIds,
        focusNode,
        focusedNodeId,
        getVisibleNodeIds,
        highlightBounds,
        highlightColor,
        iconMap: mergedIconMap,
        indentSize,
        isNodeVisible,
        moveFocus,
        onItemKeyDown,
        onLoadChildren,
        onNodeClick,
        onNodeExpand,
        reduceMotion,
        registerNode,
        registryVersion,
        searchQuery,
        selectNode,
        selectedIds,
        selectionMode,
        setFocusedNodeId,
        setHighlightBounds,
        setHighlightFromElement,
        showIcons,
        toggleExpanded,
        truncate,
        unregisterNode,
      }),
      [
        collapseAll,
        expandAll,
        expandedIds,
        focusNode,
        focusedNodeId,
        getVisibleNodeIds,
        highlightBounds,
        highlightColor,
        indentSize,
        isNodeVisible,
        mergedIconMap,
        moveFocus,
        onItemKeyDown,
        onLoadChildren,
        onNodeClick,
        onNodeExpand,
        reduceMotion,
        registerNode,
        registryVersion,
        searchQuery,
        selectNode,
        selectedIds,
        selectionMode,
        setHighlightFromElement,
        showIcons,
        toggleExpanded,
        truncate,
        unregisterNode,
      ],
    );

    return (
      <FileTreeContext.Provider value={contextValue}>
        <div className={cn('xft', className)} {...props}>
          <div
            className={cn('xft-scroll', maxHeight !== undefined && 'xft-scroll--capped')}
            onMouseLeave={() => setHighlightBounds(null)}
            onScroll={handleContainerScroll}
            ref={containerRef}
            style={maxHeight !== undefined ? { maxHeight } : undefined}
          >
            <FileTreeHoverHighlight
              className="xft-hover"
              reduceMotion={reduceMotion}
            />
            {children}
          </div>
        </div>
      </FileTreeContext.Provider>
    );
  },
);

FileTree.displayName = 'FileTree';

export function FileTreeList({
  children,
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <BranchContext.Provider value={{ level: 1, parentId: null }}>
      <div className={cn('xft-list', className)} role="tree" {...props}>
        <BranchSiblingProvider>{children}</BranchSiblingProvider>
      </div>
    </BranchContext.Provider>
  );
}

export type FileTreeItemProps = Omit<
  React.ComponentProps<'button'>,
  'children'
> & {
  children?: React.ReactNode;
  hasChildren?: boolean;
  highlight?: boolean;
  icon?: React.ReactNode;
  openIcon?: React.ReactNode;
  label: string;
  loading?: boolean;
  nodeId: string;
};

export function FileTreeItem({
  children,
  className,
  disabled = false,
  hasChildren,
  highlight,
  icon,
  loading = false,
  openIcon,
  label,
  nodeId,
  onClick,
  onFocus,
  onKeyDown,
  ...props
}: FileTreeItemProps) {
  const {
    expandedIds,
    focusNode,
    focusedNodeId,
    getVisibleNodeIds,
    indentSize,
    isNodeVisible,
    onItemKeyDown,
    onLoadChildren,
    onNodeClick,
    reduceMotion,
    registerNode,
    selectNode,
    selectedIds,
    selectionMode,
    setFocusedNodeId,
    toggleExpanded,
    truncate,
    unregisterNode,
  } = useFileTree();

  const { level, parentId } = React.useContext(BranchContext);
  const { index: siblingIndex, count: siblingCount } =
    React.useContext(SiblingMetaContext);

  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const rowRef = React.useRef<HTMLDivElement>(null);
  const highlightTarget = useHighlightTarget();

  const childNodes = React.Children.toArray(children).filter(Boolean);
  const isBranch =
    hasChildren !== undefined ? hasChildren : childNodes.length > 0;
  const isOpen = expandedIds.has(nodeId);
  const isSelected = selectedIds.has(nodeId);
  const isFocused = focusedNodeId === nodeId;
  const visible = isNodeVisible(nodeId);
  const visibleIds = getVisibleNodeIds();
  const isFirstVisible = visibleIds[0] === nodeId;

  React.useLayoutEffect(() => {
    registerNode({
      buttonRef,
      disabled: Boolean(disabled),
      isBranch,
      label,
      level,
      nodeId,
      parentId,
      rowRef,
      siblingIndex,
      siblingCount,
    });
    return () => unregisterNode(nodeId);
  }, [
    disabled,
    isBranch,
    label,
    level,
    nodeId,
    parentId,
    registerNode,
    siblingCount,
    siblingIndex,
    unregisterNode,
  ]);

  React.useEffect(() => {
    if (isOpen && isBranch && childNodes.length === 0 && hasChildren) {
      onLoadChildren?.(nodeId);
    }
  }, [
    childNodes.length,
    hasChildren,
    isBranch,
    isOpen,
    nodeId,
    onLoadChildren,
  ]);

  const handleActivate = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    onClick?.(event);
    if (event.defaultPrevented) return;
    const additive =
      selectionMode === 'multiple' && (event.metaKey || event.ctrlKey);
    const range = selectionMode === 'multiple' && event.shiftKey;
    if (isBranch && !additive && !range) toggleExpanded(nodeId);
    selectNode(nodeId, { additive, range });
    onNodeClick?.(nodeId, event);
  };

  const itemButton = (
    <button
      type="button"
      aria-expanded={isBranch ? isOpen : undefined}
      aria-label={label}
      aria-level={level}
      aria-posinset={siblingIndex + 1}
      aria-selected={isSelected}
      aria-setsize={siblingCount}
      className={cn(
        'xft-item',
        isBranch && 'xft-item--dir',
        isSelected && 'is-selected',
        className,
      )}
      disabled={disabled}
      hidden={!visible}
      onClick={handleActivate}
      onDoubleClick={() => {
        if (isBranch) {
          toggleExpanded(nodeId, true);
          focusNode(nodeId);
        }
      }}
      onFocus={(event) => {
        onFocus?.(event);
        if (disabled) return;
        setFocusedNodeId(nodeId);
        highlightTarget.onFocus();
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented || disabled) return;
        onItemKeyDown(event);
      }}
      ref={buttonRef}
      role="treeitem"
      tabIndex={
        !visible || disabled
          ? -1
          : isFocused || (!focusedNodeId && isFirstVisible)
            ? 0
            : -1
      }
      {...props}
    >
      <div
        onMouseEnter={highlightTarget.onMouseEnter}
        ref={(element) => {
          rowRef.current = element;
          highlightTarget.ref.current = element;
        }}
      >
        <FileTreeRowContent
          highlight={highlight}
          icon={icon}
          isBranch={isBranch}
          isOpen={isOpen}
          label={label}
          loading={loading}
          openIcon={openIcon}
          truncate={truncate}
        />
      </div>
    </button>
  );

  if (!isBranch) {
    return (
      <div data-value={nodeId} hidden={visible ? undefined : true}>
        {itemButton}
      </div>
    );
  }

  return (
    <div data-value={nodeId} hidden={visible ? undefined : true}>
      {itemButton}
      <fieldset
        className="xft-branch"
        style={{ marginLeft: indentSize }}
      >
        <FolderContent isOpen={isOpen} reduceMotion={reduceMotion}>
          <BranchContext.Provider
            value={{ level: level + 1, parentId: nodeId }}
          >
            <BranchSiblingProvider>{children}</BranchSiblingProvider>
          </BranchContext.Provider>
        </FolderContent>
      </fieldset>
    </div>
  );
}

function FileTreeItemFromData({ item }: { item: FileTreeNodeData }) {
  return (
    <FileTreeItem
      disabled={item.disabled}
      hasChildren={item.hasChildren}
      highlight={item.highlight}
      icon={item.icon}
      label={item.label}
      loading={item.loading}
      nodeId={item.id}
      openIcon={item.openIcon}
    >
      {item.children?.map((child) => (
        <FileTreeItemFromData item={child} key={child.id} />
      ))}
    </FileTreeItem>
  );
}

export type FileTreeFromItemsProps = FileTreeProps & {
  items: FileTreeNodeData[];
};

export const FileTreeFromItems = React.forwardRef<
  FileTreeHandle,
  FileTreeFromItemsProps
>(function FileTreeFromItems({ items, children, ...treeProps }, ref) {
  return (
    <FileTree ref={ref} {...treeProps}>
      <FileTreeList>
        {items.map((item) => (
          <FileTreeItemFromData item={item} key={item.id} />
        ))}
      </FileTreeList>
      {children}
    </FileTree>
  );
});

FileTreeFromItems.displayName = 'FileTreeFromItems';

export default FileTree;
