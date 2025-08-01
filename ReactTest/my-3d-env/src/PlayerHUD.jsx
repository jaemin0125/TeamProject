// PlayerHUD.jsx
import React, { useState } from 'react';

export function PlayerHUD({ state, playerNickname, inventory, selectedInventorySlot, selectedItem, currentAmmo, maxAmmo, isReloading, reloadProgress, isInventoryOpen, onInventoryDrop, isEating, eatProgress }) {
    const { health = 100, isHit, isDead, isAiming, isScoped, respawnProgress = 0, showInteractionPrompt, isGrounded, position } = state;
    const [draggedItem, setDraggedItem] = useState(null);

    const healthBarColor = '#ff4d4d';

    const [time, setTime] = React.useState(new Date());
    React.useEffect(() => {
        const timerId = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timerId);
    }, []);

    const formatTime = (date) => {
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    };

    const hotbarItems = inventory.slice(0, 4);

    return (
        <>
            <style>
                {`
                @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&display=swap');
                .hud-text-shadow { text-shadow: 1px 1px 2px rgba(0,0,0,0.9); }
                @keyframes hitFlash { from { opacity: 1; } to { opacity: 0; } }
                @keyframes fadeInOut { 0% { opacity: 0.7; } 100% { opacity: 1; } }
                @keyframes pulse { 0% { color: #cccccc; } 50% { color: white; } 100% { color: #cccccc; } }
                `}
            </style>

            <div style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                pointerEvents: 'none', zIndex: 999,
                fontFamily: '"Orbitron", sans-serif', color: '#cccccc',
                filter: isDead ? 'grayscale(100%)' : 'none',
            }}>

                {/* Top-Left Player Info */}
                <div style={{ position: 'absolute', top: '20px', left: '20px', display: 'flex', alignItems: 'center' }}>
                    <img src="/textures/boss.png" alt="player" style={{ width: '60px', height: '60px', borderRadius: '5px', border: '1px solid rgba(128, 128, 128, 0.7)' }} />
                    <div style={{ marginLeft: '15px' }}>
                        <div className="hud-text-shadow" style={{ fontWeight: 'bold', fontSize: '1.2em', color: 'white' }}>{playerNickname}</div>
                        <div style={{ width: '200px', height: '15px', backgroundColor: 'rgba(0,0,0,0.5)', border: '1px solid #222', borderRadius: '5px', marginTop: '5px', overflow: 'hidden' }}>
                            <div style={{ width: `${health}%`, height: '100%', backgroundColor: healthBarColor, transition: 'width 0.5s' }}></div>
                        </div>
                    </div>
                </div>

                {/* Top-Center Timer */}
                <div className="hud-text-shadow" style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', fontSize: '2.5em', letterSpacing: '3px', color: '#cccccc' }}>
                    {formatTime(time)}
                </div>

                {/* Right-Side Vertical Hotbar */}
                <div style={{ position: 'absolute', right: '30px', top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-end' }}>
                    {hotbarItems.map((item, index) => {
                        const isSelected = selectedInventorySlot === index;
                        return (
                            <div key={index} style={{
                                width: isSelected ? '80px' : '70px',
                                height: isSelected ? '80px' : '70px',
                                border: `2px solid ${isSelected ? 'gold' : 'rgba(128, 128, 128, 0.5)'}`,
                                borderRadius: '10px',
                                backgroundColor: isSelected ? 'rgba(50, 50, 50, 0.8)' : 'rgba(0, 0, 0, 0.6)',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                alignItems: 'center',
                                padding: '5px',
                                boxSizing: 'border-box',
                                transition: 'all 0.2s ease-in-out',
                                position: 'relative', // For absolute positioning of the number
                            }}>
                                <span style={{ position: 'absolute', top: '5px', left: '7px', color: 'rgba(255,255,255,0.5)', fontSize: '0.8em' }}>{`0${index + 1}`}</span>
                                {item ? <img src={item.image} alt={item.name} style={{
                                    width: isSelected ? '60px' : '40px',
                                    height: isSelected ? '60px' : '40px',
                                    objectFit: 'contain',
                                    transition: 'all 0.2s ease-in-out'
                                }} /> : <div></div>}
                            </div>
                        )
                    })}
                </div>

                {/* Bottom-Right Ammo Count */}
                {!isDead && selectedItem?.name === 'ak-47' && (
                    <div className="hud-text-shadow" style={{ position: 'absolute', bottom: '30px', right: '30px', backgroundColor: 'rgba(0, 0, 0, 0.6)', padding: '15px 25px', borderRadius: '10px', border: '1px solid rgba(128, 128, 128, 0.5)', textAlign: 'right' }}>
                        {isReloading ? (
                            <div style={{ fontSize: '1.5em', color: '#cccccc' }}>RELOADING...</div>
                        ) : currentAmmo === 0 && maxAmmo > 0 ? (
                            <div style={{ fontSize: '1.2em', animation: 'pulse 1.5s infinite' }}>PRESS [R] TO RELOAD</div>
                        ) : (
                            <div>
                                <span style={{ fontSize: '2.5em', fontWeight: 'bold', color: 'white' }}>{currentAmmo}</span>
                                <span style={{ fontSize: '1.5em', color: 'rgba(255,255,255,0.7)' }}> / {maxAmmo}</span>
                            </div>
                        )}
                    </div>
                )}

                {!isDead && !isAiming && !isScoped && selectedItem?.name === 'ak-47' && !isInventoryOpen && (
                    <div
                        style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: '40px',
                            height: '40px',
                            pointerEvents: 'none',
                            zIndex: 9999,
                        }}
                    >
                        {/* 위쪽 라인 */}
                        <div style={{
                            position: 'absolute',
                            top: '1px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: '2px',
                            height: '8px',
                            backgroundColor: 'white',
                            boxShadow: '0 0 4px black',
                        }}></div>

                        {/* 아래쪽 라인 */}
                        <div style={{
                            position: 'absolute',
                            bottom: '1px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: '2px',
                            height: '8px',
                            backgroundColor: 'white',
                            boxShadow: '0 0 4px black',
                        }}></div>

                        {/* 왼쪽 라인 */}
                        <div style={{
                            position: 'absolute',
                            left: '1px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            width: '8px',
                            height: '2px',
                            backgroundColor: 'white',
                            boxShadow: '0 0 4px black',
                        }}></div>

                        {/* 오른쪽 라인 */}
                        <div style={{
                            position: 'absolute',
                            right: '1px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            width: '8px',
                            height: '2px',
                            backgroundColor: 'white',
                            boxShadow: '0 0 4px black',
                        }}></div>
                    </div>
                )}


                {/* 크로스헤어 (사망 중이 아닐 때만) */}
                {!isDead && isAiming && !isScoped && selectedItem?.name === 'ak-47' && !isInventoryOpen && (
                    <div
                        style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: '24px',
                            height: '24px',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            pointerEvents: 'none',
                            zIndex: 9999, // 다른 UI 위에 올라오게 충분히 크게 설정
                        }}
                    >
                        {/* 수직선 */}
                        <div style={{
                            position: 'absolute',
                            width: '2px',
                            height: '100%',
                            backgroundColor: 'white',
                            boxShadow: '0 0 4px black',
                        }}></div>
                        {/* 수평선 */}
                        <div style={{
                            position: 'absolute',
                            width: '100%',
                            height: '2px',
                            backgroundColor: 'white',
                            boxShadow: '0 0 4px black',
                        }}></div>
                        {/* 중앙 점 */}
                        <div style={{
                            position: 'absolute',
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: 'white',
                            boxShadow: '0 0 6px black',
                        }}></div>
                    </div>
                )}
                {isScoped && (
                    <>
                        <img src="/textures/2xScope.png" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain', zIndex: 20000 }} />
                        <div style={{ position: 'absolute', top: '50%', left: '50%', width: '6px', height: '6px', backgroundColor: 'red', borderRadius: '50%', transform: 'translate(-50%, -50%)', zIndex: 20000 }} />
                    </>
                )}

                {/* Interaction Prompt */}
                {showInteractionPrompt && !isDead && (
                    <div className="hud-text-shadow" style={{ position: 'absolute', top: 'calc(50% + 40px)', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '1.5em', backgroundColor: 'rgba(0, 0, 0, 0.7)', padding: '10px 20px', borderRadius: '10px', animation: 'fadeInOut 1.5s ease-in-out infinite alternate' }}>
                        Press <span style={{ color: 'gold', fontWeight: 'bold' }}>[F]</span>
                    </div>
                )}

                {/* Death Screen */}
                {isDead && (
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                        <div className="hud-text-shadow" style={{ color: '#ff4d4d', fontSize: '4em', fontWeight: 'bold' }}>YOU ARE DEAD</div>
                        <div className="hud-text-shadow" style={{ fontSize: '1.5em', marginTop: '10px' }}>Respawning in {Math.ceil(5 - respawnProgress)} seconds...</div>
                    </div>
                )}

                {/* Eating Progress Bar */}
                {isEating && (
                    <div style={{ position: 'absolute', bottom: '150px', left: '50%', transform: 'translateX(-50%)', width: '200px', height: '20px', backgroundColor: 'rgba(0,0,0,0.5)', border: '1px solid #222', borderRadius: '5px', overflow: 'hidden' }}>
                        <div style={{ width: `${eatProgress}%`, height: '100%', backgroundColor: '#4caf50', transition: 'width 0.1s linear' }}></div>
                        <div className="hud-text-shadow" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'white' }}>Eating...</div>
                    </div>
                )}

                {/* Hit Flash */}
                {isHit && !isDead && <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(255, 0, 0, 0.3)', animation: 'hitFlash 0.5s forwards' }}></div>}

                {/* Inventory Screen */}
                {isInventoryOpen && (
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '60vw', height: '60vh', maxWidth: '800px', maxHeight: '500px', display: 'flex', backgroundColor: 'rgba(20, 20, 20, 0.85)', borderRadius: '10px', border: '1px solid rgba(128, 128, 128, 0.5)', zIndex: 1001, pointerEvents: 'auto' }}>
                        {/* Left Panel */}
                        <div style={{ flex: 1, padding: '20px', borderRight: '1px solid rgba(128, 128, 128, 0.5)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            {selectedItem ? (
                                <>
                                    <img src={selectedItem.image} alt={selectedItem.name} style={{ width: '150px', height: '150px', objectFit: 'contain' }} />
                                    <h2 className="hud-text-shadow" style={{ color: 'white', marginTop: '20px', fontSize: '2em' }}>{selectedItem.name}</h2>
                                    <p className="hud-text-shadow" style={{ color: '#cccccc', textAlign: 'center', marginTop: '10px' }}>
                                        {selectedItem.name === 'ak-47' ? `A reliable assault rifle. Holds ${selectedItem.magazineSize} rounds.` : selectedItem.name === 'apple' ? 'Restores a small amount of health.' : 'A standard issue item.'}
                                    </p>
                                    {selectedItem.count > 1 && <span className="hud-text-shadow" style={{ fontSize: '1.2em', marginTop: '20px' }}>Quantity: {selectedItem.count}</span>}
                                </> 
                            ) : (
                                <div className="hud-text-shadow" style={{ color: 'rgba(255,255,255,0.3)', fontSize: '1.5em' }}>SELECT AN ITEM</div>
                            )}
                        </div>
                        {/* Right Panel */}
                        <div style={{ flex: 2, padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: 'repeat(2, 1fr)', gap: '15px' }}>
                            {inventory.map((item, index) => (
                                <div key={index} 
                                draggable 
                                onDragStart={(e) => {
                                    e.dataTransfer.setData("draggedIndex", index);
                                    setDraggedItem(index);
                                }}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => {
                                    const draggedIndex = e.dataTransfer.getData("draggedIndex");
                                    if (draggedIndex !== "") {
                                        onInventoryDrop(parseInt(draggedIndex), index);
                                    }
                                }}
                                style={{
                                    border: `1px solid ${selectedInventorySlot === index ? 'gold' : 'rgba(128, 128, 128, 0.7)'}`,
                                    borderRadius: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                    backgroundColor: 'rgba(0, 0, 0, 0.3)', transition: 'all 0.2s ease-in-out',
                                    transform: selectedInventorySlot === index ? 'scale(1.05)' : 'scale(1)', position: 'relative',
                                    opacity: draggedItem === index ? 0.5 : 1
                                }}>
                                    {item ? (
                                        <>
                                            <img src={item.image} alt={item.name} style={{ width: '60px', height: '60px', objectFit: 'contain' }} />
                                            <span className="hud-text-shadow" style={{ fontSize: '0.8em', marginTop: '5px' }}>{item.name}</span>
                                            {item.count > 1 && <span className="hud-text-shadow" style={{ position: 'absolute', bottom: '5px', right: '8px', fontSize: '0.9em' }}>x{item.count}</span>}
                                        </>
                                    ) : <span className="hud-text-shadow" style={{ color: 'rgba(255,255,255,0.3)', fontSize: '2.5em' }}>{index + 1}</span>}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Debug Info */}
                <div style={{ position: 'absolute', bottom: '10px', left: '10px', backgroundColor: 'rgba(0,0,0,0.5)', padding: '5px 10px', borderRadius: '5px', fontSize: '12px' }}>
                    <div className="hud-text-shadow">Grounded: {isGrounded ? 'Yes' : 'No'}</div>
                    {position && typeof position.x === 'number' && (
                        <div className="hud-text-shadow">Pos: {position.x.toFixed(2)}, {position.y.toFixed(2)}, {position.z.toFixed(2)}</div>
                    )}
                </div>
            </div>
        </>
    );
}
