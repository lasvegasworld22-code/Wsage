import { useEffect, useRef, useState } from 'react';
import { WorldEngine } from '../world/WorldEngine';

export const World=({agents,wallet,onInteract,engineRef,entered=false})=>{
 const mount=useRef();const labels=useRef();const interaction=useRef(onInteract);interaction.current=onInteract;const [error,setError]=useState(false);
 useEffect(()=>{let engine;try{engine=new WorldEngine(mount.current,labels.current,e=>interaction.current(e));engineRef.current=engine;}catch(e){console.error(e);setError(true);}return()=>{engine?.dispose();engineRef.current=null;};},[engineRef]);
 useEffect(()=>{engineRef.current?.updateAgents(agents,wallet);},[agents,wallet,engineRef]);
 useEffect(()=>{engineRef.current?.setEntered(entered);},[entered,engineRef]);
 return <><div className="world-canvas" ref={mount} data-testid="world-scene"/><div className="world-labels" ref={labels}/>{error&&<div className="world-error" data-testid="webgl-error">3D graphics are unavailable in this browser. All agent features remain accessible from the navigation.</div>}</>;
};