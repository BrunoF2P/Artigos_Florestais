import React, { useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';

interface NetworkNode {
  id: string;
  label: string;
  radius: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  articlesCount: number;
  color: string;
  fx?: number | null;
  fy?: number | null;
}

interface NetworkEdge {
  source: NetworkNode;
  target: NetworkNode;
  weight: number;
}

interface NetworkCanvasProps {
  type: 'keywords' | 'coauthorship';
}

const COLORS = [
  '#00b4d8', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6',
  '#06b6d4', '#14b8a6', '#f43f5e', '#6366f1', '#22c55e',
];

function truncate(str: string, n: number) {
  if (!str) return '';
  return str.length <= n ? str : str.slice(0, n) + '…';
}

export const NetworkCanvas: React.FC<NetworkCanvasProps> = ({ type }) => {
  const articles = useAppStore(s => s.articles);
  const conceptualGroups = useAppStore(s => s.conceptualGroups);
  const authors = useAppStore(s => s.authors);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    nodes: [] as NetworkNode[],
    edges: [] as NetworkEdge[],
    transform: { x: 0, y: 0, scale: 1 },
    alpha: 1.0,
    hoveredNode: null as NetworkNode | null,
    draggingNode: null as NetworkNode | null,
    draggingStage: false,
    lastMouseX: 0,
    lastMouseY: 0,
    rafId: null as number | null,
    pendingDrawId: null as number | null,
    isDark: false,
  });

  const scheduleRedraw = useCallback(() => {
    const s = stateRef.current;
    if (s.pendingDrawId !== null || s.rafId !== null) return;
    s.pendingDrawId = requestAnimationFrame(() => {
      s.pendingDrawId = null;
      drawNetwork();
    });
  }, []);

  const getMousePos = useCallback((e: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const { x: tx, y: ty, scale } = stateRef.current.transform;
    return {
      x: (e.clientX - rect.left - tx) / scale,
      y: (e.clientY - rect.top - ty) / scale,
    };
  }, []);

  const findNodeAt = useCallback((x: number, y: number): NetworkNode | null => {
    const nodes = stateRef.current.nodes;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      if (Math.hypot(n.x - x, n.y - y) <= n.radius + 2) return n;
    }
    return null;
  }, []);

  const drawNetwork = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const s = stateRef.current;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(s.transform.x, s.transform.y);
    ctx.scale(s.transform.scale, s.transform.scale);

    const { nodes, edges, hoveredNode: hovered, isDark } = s;

    // Pre-compute connected set for hover highlight
    const connectedIds = new Set<string>();
    if (hovered) {
      edges.forEach(e => {
        if (e.source.id === hovered.id) connectedIds.add(e.target.id);
        else if (e.target.id === hovered.id) connectedIds.add(e.source.id);
      });
    }

    // 1. Draw edges
    edges.forEach(edge => {
      const { source: s2, target: t } = edge;
      const isHighlighted = hovered && (hovered.id === s2.id || hovered.id === t.id);
      const alpha = hovered
        ? (isHighlighted ? 0.7 : 0.02)
        : (isDark ? 0.12 : 0.18);

      ctx.beginPath();
      ctx.moveTo(s2.x, s2.y);
      ctx.lineTo(t.x, t.y);
      ctx.lineWidth = isHighlighted
        ? Math.max(3, Math.sqrt(edge.weight) * 2.5)
        : Math.max(0.8, Math.sqrt(edge.weight) * 0.82);

      try {
        const grad = ctx.createLinearGradient(s2.x, s2.y, t.x, t.y);
        grad.addColorStop(0, s2.color);
        grad.addColorStop(1, t.color);
        ctx.strokeStyle = grad;
      } catch {
        ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)';
      }
      ctx.globalAlpha = alpha;
      ctx.stroke();
    });
    ctx.globalAlpha = 1;

    // 2. Draw nodes
    nodes.forEach(node => {
      const isHovered = hovered?.id === node.id;
      const isConnected = hovered && !isHovered && connectedIds.has(node.id);

      ctx.save();
      let color = node.color;
      let bubbleAlpha = 0.88;

      if (hovered) {
        if (isHovered) { color = '#f59e0b'; bubbleAlpha = 1; ctx.shadowColor = '#f59e0b'; ctx.shadowBlur = 18; }
        else if (isConnected) { bubbleAlpha = 1; ctx.shadowColor = node.color; ctx.shadowBlur = 12; }
        else { color = isDark ? '#1e293b' : '#f1f5f9'; bubbleAlpha = 0.15; }
      } else {
        ctx.shadowColor = 'rgba(0,0,0,0.1)';
        ctx.shadowBlur = 6;
      }

      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius + (isHovered ? 2 : 0), 0, Math.PI * 2);
      ctx.globalAlpha = bubbleAlpha;
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = isHovered ? '#fff' : (isDark ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.85)');
      ctx.lineWidth = isHovered ? 3 : (isConnected ? 2 : 1.5);
      ctx.stroke();
      ctx.restore();

      // Labels
      const baseFontSize = Math.max(10, Math.min(15, Math.ceil(node.radius * 0.42)));
      const fontSize = isHovered ? baseFontSize + 3 : baseFontSize;
      ctx.save();
      ctx.font = `${isHovered ? '800' : '600'} ${fontSize}px "Plus Jakarta Sans", sans-serif`;
      ctx.textAlign = 'center';

      const labelX = node.x;
      const labelY = node.y + node.radius + fontSize + 4;

      let textColor = isDark ? '#e2e8f0' : '#1e293b';
      let textAlpha = 0.95;
      if (hovered) {
        if (isHovered) { textColor = '#f59e0b'; textAlpha = 1; }
        else if (isConnected) { textColor = isDark ? '#f8fafc' : '#0f172a'; textAlpha = 1; }
        else { textColor = isDark ? '#475569' : '#94a3b8'; textAlpha = 0.2; }
      }

      ctx.globalAlpha = textAlpha;
      ctx.strokeStyle = isDark ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.95)';
      ctx.lineWidth = 4;
      ctx.strokeText(truncate(node.label, isHovered ? 22 : 16), labelX, labelY);
      ctx.fillStyle = textColor;
      ctx.fillText(truncate(node.label, isHovered ? 22 : 16), labelX, labelY);
      ctx.restore();
    });

    ctx.restore();
  }, []);

  const runSimulation = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const s = stateRef.current;
    const isKw = type === 'keywords';
    const kAlpha = 0.085;
    const repulsion = isKw ? 1200 : 450;
    const attraction = isKw ? 0.015 : 0.075;
    const center = isKw ? 0.025 : 0.02;
    const friction = 0.78;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    s.alpha = 1.0;

    function step() {
      if (s.alpha < 0.005) {
        drawNetwork();
        s.rafId = null;
        return;
      }
      const { nodes, edges } = s;

      // Repulsion
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = b.x - a.x || 0.01;
          const dy = b.y - a.y || 0.01;
          const dist = Math.hypot(dx, dy);
          const minD = a.radius + b.radius + 15;
          if (dist < minD) {
            const push = (minD - dist) * 0.45;
            const fx = (dx / dist) * push;
            const fy = (dy / dist) * push;
            if (!a.fx) { a.vx -= fx; a.vy -= fy; }
            if (!b.fx) { b.vx += fx; b.vy += fy; }
          } else {
            const charge = (repulsion * a.radius * b.radius) / (dist * dist);
            const fx = (dx / dist) * charge;
            const fy = (dy / dist) * charge;
            if (!a.fx) { a.vx -= fx; a.vy -= fy; }
            if (!b.fx) { b.vx += fx; b.vy += fy; }
          }
        }
      }

      // Attraction
      const baseRest = isKw ? 160 : 100;
      edges.forEach(edge => {
        const dx = edge.target.x - edge.source.x;
        const dy = edge.target.y - edge.source.y;
        const dist = Math.hypot(dx, dy) || 0.01;
        const restLength = baseRest - Math.min(60, edge.weight * (isKw ? 2 : 5));
        const k = attraction * Math.sqrt(edge.weight);
        const pull = (dist - restLength) * k;
        const fx = (dx / dist) * pull;
        const fy = (dy / dist) * pull;
        if (!edge.source.fx) { edge.source.vx += fx; edge.source.vy += fy; }
        if (!edge.target.fx) { edge.target.vx -= fx; edge.target.vy -= fy; }
      });

      // Gravity
      nodes.forEach(node => {
        if (!node.fx) {
          node.vx += (cx - node.x) * center;
          node.vy += (cy - node.y) * center;
        }
      });

      // Integrate
      nodes.forEach(node => {
        if (node.fx != null) {
          node.x = node.fx;
          node.y = node.fy!;
          node.vx = 0;
          node.vy = 0;
        } else {
          node.vx *= friction;
          node.vy *= friction;
          node.x += node.vx * kAlpha * s.alpha;
          node.y += node.vy * kAlpha * s.alpha;
        }
      });

      s.alpha *= 0.975;
      drawNetwork();
      s.rafId = requestAnimationFrame(step);
    }

    if (s.rafId) cancelAnimationFrame(s.rafId);
    step();
  }, [type, drawNetwork]);

  const buildNetwork = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || articles.length === 0) return;

    const w = canvas.parentElement?.clientWidth || canvas.width;
    const h = canvas.parentElement?.clientHeight || canvas.height;
    canvas.width = w;
    canvas.height = h;

    if (w === 0 || h === 0) {
      setTimeout(buildNetwork, 60);
      return;
    }

    const s = stateRef.current;
    if (s.rafId) { cancelAnimationFrame(s.rafId); s.rafId = null; }

    const nodes: NetworkNode[] = [];
    const edgesMap = new Map<string, number>();

    if (type === 'keywords') {
      const limitKw = conceptualGroups.slice(0, 35);
      const limitSet = new Set(limitKw.map(k => k.normalized));
      const counts = limitKw.map(k => k.articlesCount || 1);
      const maxV = Math.max(...counts, 1);
      const minV = Math.min(...counts, 1);
      const range = maxV - minV;

      limitKw.forEach((kw, idx) => {
        const pct = range > 0 ? (kw.articlesCount - minV) / range : 0;
        const radius = 12 + Math.sqrt(pct) * 36;
        const angle = (idx / limitKw.length) * Math.PI * 2;
        nodes.push({
          id: kw.normalized,
          label: kw.rawKeywords[0] || kw.normalized,
          radius,
          x: w / 2 + Math.cos(angle) * 260 + (Math.random() - 0.5) * 60,
          y: h / 2 + Math.sin(angle) * 260 + (Math.random() - 0.5) * 60,
          vx: 0, vy: 0,
          articlesCount: kw.articlesCount,
          color: COLORS[idx % COLORS.length],
        });
      });

      articles.forEach(art => {
        const kwNorm = [...new Set(art.keywords.map(k => k.normalized))];
        for (let i = 0; i < kwNorm.length; i++) {
          if (!limitSet.has(kwNorm[i])) continue;
          for (let j = i + 1; j < kwNorm.length; j++) {
            if (!limitSet.has(kwNorm[j])) continue;
            const key = [kwNorm[i], kwNorm[j]].sort().join('::');
            edgesMap.set(key, (edgesMap.get(key) || 0) + 1);
          }
        }
      });
    } else {
      const limitAuth = authors.slice(0, 45);
      const limitSet = new Set(limitAuth.map(a => a.name));
      const counts = limitAuth.map(a => a.articlesCount || 1);
      const maxV = Math.max(...counts, 1);
      const minV = Math.min(...counts, 1);
      const range = maxV - minV;

      limitAuth.forEach((auth, idx) => {
        const pct = range > 0 ? (auth.articlesCount - minV) / range : 0;
        const radius = 10 + Math.sqrt(pct) * 28;
        const angle = (idx / limitAuth.length) * Math.PI * 2;
        nodes.push({
          id: auth.name,
          label: auth.fullName || auth.name,
          radius,
          x: w / 2 + Math.cos(angle) * 240 + (Math.random() - 0.5) * 50,
          y: h / 2 + Math.sin(angle) * 240 + (Math.random() - 0.5) * 50,
          vx: 0, vy: 0,
          articlesCount: auth.articlesCount,
          color: COLORS[idx % COLORS.length],
        });
      });

      articles.forEach(art => {
        const names = art.authors.map(a => a.name);
        for (let i = 0; i < names.length; i++) {
          if (!limitSet.has(names[i])) continue;
          for (let j = i + 1; j < names.length; j++) {
            if (!limitSet.has(names[j])) continue;
            const key = [names[i], names[j]].sort().join('::');
            edgesMap.set(key, (edgesMap.get(key) || 0) + 1);
          }
        }
      });
    }

    const nodeById = new Map(nodes.map(n => [n.id, n]));
    const edges: NetworkEdge[] = [];
    edgesMap.forEach((weight, key) => {
      const sep = key.indexOf('::');
      const src = nodeById.get(key.slice(0, sep));
      const tgt = nodeById.get(key.slice(sep + 2));
      if (src && tgt) edges.push({ source: src, target: tgt, weight });
    });

    s.nodes = nodes;
    s.edges = edges;
    s.transform = { x: 0, y: 0, scale: 1 };
    runSimulation();
  }, [articles, conceptualGroups, authors, type, runSimulation]);

  // Build/rebuild on data or type change
  useEffect(() => {
    if (articles.length > 0) {
      // Small delay to ensure canvas is rendered
      const t = setTimeout(buildNetwork, 100);
      return () => clearTimeout(t);
    }
  }, [articles, type, buildNetwork]);

  // Mouse events
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onMouseDown = (e: MouseEvent) => {
      const pos = getMousePos(e);
      const node = findNodeAt(pos.x, pos.y);
      const s = stateRef.current;
      if (node) {
        s.draggingNode = node;
        node.fx = node.x;
        node.fy = node.y;
        if (s.alpha < 0.1) { s.alpha = 0.3; runSimulation(); }
      } else {
        s.draggingStage = true;
        s.lastMouseX = e.clientX;
        s.lastMouseY = e.clientY;
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      const pos = getMousePos(e);
      const s = stateRef.current;
      const found = findNodeAt(pos.x, pos.y);

      if (found !== s.hoveredNode) {
        s.hoveredNode = found;
        scheduleRedraw();
      }

      if (s.draggingNode) {
        const { scale, x: tx, y: ty } = s.transform;
        const nx = (e.offsetX - tx) / scale;
        const ny = (e.offsetY - ty) / scale;
        s.draggingNode.x = nx; s.draggingNode.y = ny;
        s.draggingNode.fx = nx; s.draggingNode.fy = ny;
        scheduleRedraw();
      } else if (s.draggingStage) {
        s.transform.x += e.clientX - s.lastMouseX;
        s.transform.y += e.clientY - s.lastMouseY;
        s.lastMouseX = e.clientX;
        s.lastMouseY = e.clientY;
        scheduleRedraw();
      }
    };

    const onMouseUp = () => {
      const s = stateRef.current;
      if (s.draggingNode) {
        s.draggingNode.fx = null;
        s.draggingNode.fy = null;
        s.draggingNode = null;
      }
      s.draggingStage = false;
    };

    const onMouseLeave = () => {
      const s = stateRef.current;
      if (s.draggingNode) { s.draggingNode.fx = null; s.draggingNode.fy = null; s.draggingNode = null; }
      s.draggingStage = false;
      s.hoveredNode = null;
      scheduleRedraw();
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const s = stateRef.current;
      const factor = e.deltaY < 0 ? 1.05 : 1 / 1.05;
      const nextScale = Math.max(0.1, Math.min(3, s.transform.scale * factor));
      s.transform.x = e.offsetX - (e.offsetX - s.transform.x) * (nextScale / s.transform.scale);
      s.transform.y = e.offsetY - (e.offsetY - s.transform.y) * (nextScale / s.transform.scale);
      s.transform.scale = nextScale;
      scheduleRedraw();
    };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [getMousePos, findNodeAt, scheduleRedraw, runSimulation]);

  // Observe dark mode changes
  useEffect(() => {
    const observer = new MutationObserver(() => {
      stateRef.current.isDark = document.documentElement.classList.contains('dark');
      scheduleRedraw();
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    stateRef.current.isDark = document.documentElement.classList.contains('dark');
    return () => observer.disconnect();
  }, [scheduleRedraw]);

  // Resize
  useEffect(() => {
    const obs = new ResizeObserver(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const wrapper = canvas.parentElement!;
      canvas.width = wrapper.clientWidth;
      canvas.height = wrapper.clientHeight;
      scheduleRedraw();
    });
    if (canvasRef.current?.parentElement) {
      obs.observe(canvasRef.current.parentElement);
    }
    return () => obs.disconnect();
  }, [scheduleRedraw]);

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      const s = stateRef.current;
      if (s.rafId) cancelAnimationFrame(s.rafId);
      if (s.pendingDrawId) cancelAnimationFrame(s.pendingDrawId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="map-canvas"
      style={{ cursor: 'default' }}
    />
  );
};
