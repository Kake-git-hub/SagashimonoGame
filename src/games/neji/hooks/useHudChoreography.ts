/**
 * HUD の演出をゲーム状態のイベントから組み立てる
 * - 外したネジがボックス/一時置き場へ飛ぶ
 * - 届くまで行き先の穴は空のまま（hidden）
 * - 満杯ボックスは、飛んでくるネジが全部届いてから退場する
 */
import { RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { ScrewColor } from '../types';
import { ANIM } from '../constants';
import { NejiGameState } from '../logic/gameReducer';
import { PlaceTarget } from '../logic/rules';
import { DepartingBox } from '../components/BoxHud';
import { Flight, Point } from '../components/FlyingScrewLayer';

type Pending = { kind: 'place'; target: PlaceTarget; color: ScrewColor } | { kind: 'overflow'; color: ScrewColor };

function targetKey(target: PlaceTarget): string {
  return target.kind === 'box' ? `box:${target.uid}:${target.slot}` : `buffer:${target.slot}`;
}

export function useHudChoreography(state: NejiGameState, hudRef: RefObject<HTMLElement | null>) {
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const [flights, setFlights] = useState<Flight[]>([]);
  const [departing, setDeparting] = useState<DepartingBox[]>([]);

  const pendingRef = useRef(new Map<string, Pending>());
  const flightTargetRef = useRef(new Map<string, PlaceTarget>());
  const flightsToBoxRef = useRef(new Map<number, number>());
  const lastSeqRef = useRef(0);
  const generationRef = useRef(state.generation);
  const timersRef = useRef<number[]>([]);

  const holeCenter = useCallback((key: string): Point => {
    const hud = hudRef.current;
    const hole = hud?.querySelector<HTMLElement>(`[data-hole="${key}"]`);
    const el = hole ?? hud;
    if (!el) return { x: window.innerWidth / 2, y: 80 };
    const rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, [hudRef]);

  const addHidden = useCallback((key: string) => {
    setHidden(prev => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, []);

  const removeHidden = useCallback((key: string) => {
    setHidden(prev => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const changeBoxFlights = useCallback((uid: number, delta: number) => {
    const count = (flightsToBoxRef.current.get(uid) ?? 0) + delta;
    flightsToBoxRef.current.set(uid, count);
    if (count <= 0) {
      setDeparting(prev => prev.map(d => (d.uid === uid && !d.ready ? { ...d, ready: true } : d)));
    }
  }, []);

  const startFlight = useCallback((flight: Flight, target: PlaceTarget | null) => {
    if (target) flightTargetRef.current.set(flight.id, target);
    setFlights(prev => [...prev, flight]);
  }, []);

  // リセット（もういちど・ステージ切替）
  useEffect(() => {
    if (state.generation === generationRef.current) return;
    generationRef.current = state.generation;
    lastSeqRef.current = 0;
    pendingRef.current.clear();
    flightTargetRef.current.clear();
    flightsToBoxRef.current.clear();
    for (const t of timersRef.current) window.clearTimeout(t);
    timersRef.current = [];
    setHidden(new Set());
    setFlights([]);
    setDeparting([]);
  }, [state.generation]);

  // 新しいイベントを処理
  useEffect(() => {
    const fresh = state.events.filter(e => e.seq > lastSeqRef.current);
    if (fresh.length === 0) return;
    lastSeqRef.current = fresh[fresh.length - 1].seq;

    for (const ev of fresh) {
      switch (ev.type) {
        case 'screwPlaced':
          pendingRef.current.set(ev.screwId, { kind: 'place', target: ev.target, color: ev.color });
          addHidden(targetKey(ev.target));
          if (ev.target.kind === 'box') changeBoxFlights(ev.target.uid, 1);
          break;

        case 'bufferMoved': {
          const key = targetKey(ev.target);
          addHidden(key);
          changeBoxFlights(ev.target.uid, 1);
          const from = holeCenter(`buffer:${ev.fromSlot}`);
          // 退場中のボックスと重ならないよう少し待ってから飛ぶ
          const timer = window.setTimeout(() => {
            startFlight({ id: `move-${ev.seq}`, color: ev.color, from, to: holeCenter(key) }, ev.target);
          }, ANIM.BOX_DEPART_MS * 0.5);
          timersRef.current.push(timer);
          break;
        }

        case 'boxFull':
          setDeparting(prev => [
            ...prev,
            {
              uid: ev.uid,
              position: ev.position,
              color: ev.color,
              filled: state.stage.boxCapacity,
              ready: (flightsToBoxRef.current.get(ev.uid) ?? 0) <= 0,
            },
          ]);
          break;

        case 'overflow':
          pendingRef.current.set(ev.screwId, { kind: 'overflow', color: ev.color });
          break;

        case 'boxArrived':
          break;
      }
    }
  }, [state.events, state.stage.boxCapacity, addHidden, changeBoxFlights, holeCenter, startFlight]);

  // 退場アニメーションが終わったら消す
  useEffect(() => {
    const ready = departing.filter(d => d.ready);
    if (ready.length === 0) return;
    const timer = window.setTimeout(() => {
      setDeparting(prev => prev.filter(d => !ready.some(r => r.uid === d.uid)));
    }, ANIM.BOX_DEPART_MS);
    return () => window.clearTimeout(timer);
  }, [departing]);

  // 3D 上でネジが抜けきった → 飛ぶ演出を開始
  const onScrewRemoved = useCallback((screwId: string, from: Point) => {
    const pending = pendingRef.current.get(screwId);
    if (!pending) return;
    pendingRef.current.delete(screwId);
    if (pending.kind === 'overflow') {
      startFlight({ id: `drop-${screwId}`, color: pending.color, from, to: null }, null);
      return;
    }
    startFlight({ id: `fly-${screwId}`, color: pending.color, from, to: holeCenter(targetKey(pending.target)) }, pending.target);
  }, [holeCenter, startFlight]);

  // 飛ぶ演出が終わった → 穴を埋める
  const onFlightDone = useCallback((flightId: string) => {
    setFlights(prev => prev.filter(f => f.id !== flightId));
    const target = flightTargetRef.current.get(flightId);
    if (!target) return;
    flightTargetRef.current.delete(flightId);
    removeHidden(targetKey(target));
    if (target.kind === 'box') changeBoxFlights(target.uid, -1);
  }, [removeHidden, changeBoxFlights]);

  return { hidden, flights, departing, onScrewRemoved, onFlightDone };
}
