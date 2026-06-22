// State variables
let currentMerkleRoot = "";
let currentMerkleLeaves = [];
let currentDeposits = [];
let selectedLeafIndex = null;
let currentProof = null;
let currentProofLeaf = null;

// DOM Elements
const pinInput = document.getElementById("pin-input");
const setPinBtn = document.getElementById("set-pin-btn");
const simulateHonestBtn = document.getElementById("simulate-honest-btn");
const simulateCheatBtn = document.getElementById("simulate-cheat-btn");

const zkpStats = document.getElementById("zkp-stats");
const statRounds = document.getElementById("stat-rounds");
const statRate = document.getElementById("stat-rate");
const statProbability = document.getElementById("stat-probability");
const zkpDetails = document.getElementById("zkp-details");
const zkpAuditBody = document.getElementById("zkp-audit-body");

const coinInput = document.getElementById("coin-input");
const depositBtn = document.getElementById("deposit-btn");
const resetTreeBtn = document.getElementById("reset-tree-btn");
const merkleRootValue = document.getElementById("merkle-root-value");
const leafGridDisplay = document.getElementById("leaf-grid-display");
const anonSetSize = document.getElementById("anon-set-size");

const leafSelect = document.getElementById("leaf-select");
const proveBtn = document.getElementById("prove-btn");
const proofResult = document.getElementById("proof-result");
const proofPathDisplay = document.getElementById("proof-path-display");
const verifyProofBtn = document.getElementById("verify-proof-btn");
const verificationStatus = document.getElementById("verification-status");

// Helper to truncate hashes for UI
function truncateHash(hash, length = 12) {
    if (!hash) return "";
    if (hash === "dummy_cheater_hash_0" || hash === "dummy_cheater_hash_1" || hash === "empty_leaf_placeholder") {
        return hash;
    }
    return hash.substring(0, length) + "...";
}

// Initial Loading
document.addEventListener("DOMContentLoaded", () => {
    fetchMerkleState();
    setupEventListeners();
});

function setupEventListeners() {
    // ZKP Event Listeners
    setPinBtn.addEventListener("click", setPIN);
    simulateHonestBtn.addEventListener("click", () => runZKPSimulation(false));
    simulateCheatBtn.addEventListener("click", () => runZKPSimulation(true));

    // Merkle Tree Event Listeners
    depositBtn.addEventListener("click", depositCoin);
    resetTreeBtn.addEventListener("click", resetMerkleTree);
    proveBtn.addEventListener("click", generateMerkleProof);
    verifyProofBtn.addEventListener("click", verifyMerkleProof);
    
    // Select dropdown triggers
    leafSelect.addEventListener("change", (e) => {
        selectedLeafIndex = parseInt(e.target.value);
        proveBtn.disabled = false;
        highlightLeafNode(selectedLeafIndex);
    });
}

// ==========================================
// Part 1: ZKP API Requests & UI
// ==========================================

async function setPIN() {
    const pin = pinInput.value;
    if (!pin || pin.length !== 4 || isNaN(pin)) {
        alert("Please enter exactly a 4-digit PIN.");
        return;
    }

    try {
        const response = await fetch("/api/zkp/setup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pin: pin })
        });
        const result = await response.json();
        if (response.ok) {
            alert(result.message);
        } else {
            alert("Error: " + result.error);
        }
    } catch (error) {
        console.error("Error setting PIN:", error);
    }
}

async function runZKPSimulation(cheat) {
    // Show loading state
    if (cheat) {
        simulateCheatBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Simulating...';
        simulateCheatBtn.disabled = true;
    } else {
        simulateHonestBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Simulating...';
        simulateHonestBtn.disabled = true;
    }

    try {
        const response = await fetch("/api/zkp/simulate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cheat: cheat })
        });
        const data = await response.json();
        
        // Restore button state
        simulateCheatBtn.innerHTML = '<i class="fa-solid fa-mask"></i> Run Cheating Prover (100 Iterations)';
        simulateCheatBtn.disabled = false;
        simulateHonestBtn.innerHTML = '<i class="fa-solid fa-user-shield"></i> Run Honest Prover (100 Iterations)';
        simulateHonestBtn.disabled = false;

        if (response.ok) {
            renderZKPSimulationResults(data);
        } else {
            alert("Error running simulation: " + data.error);
        }
    } catch (error) {
        console.error("Error running ZKP simulation:", error);
        simulateCheatBtn.disabled = false;
        simulateHonestBtn.disabled = false;
    }
}

function renderZKPSimulationResults(data) {
    // Unhide panels
    zkpStats.classList.remove("hidden");
    zkpDetails.classList.remove("hidden");

    // Populate Stats
    statRounds.innerText = data.total_iterations;
    statRate.innerText = `${data.success_rate}%`;
    
    // Success rate styling
    if (data.success_rate === 100) {
        statRate.style.color = "var(--success)";
    } else {
        statRate.style.color = "var(--danger)";
    }

    // Format probability 7.88 × 10^-31
    statProbability.innerText = "7.88 × 10⁻³¹ (2⁻¹⁰⁰)";

    // Populate Table body
    zkpAuditBody.innerHTML = "";
    data.results.forEach(round => {
        const row = document.createElement("tr");
        
        const c0_trunc = truncateHash(round.commitments[0], 8);
        const c1_trunc = truncateHash(round.commitments[1], 8);
        const open_val = round.response.value;
        const open_salt = truncateHash(round.response.salt, 6);
        
        const badgeClass = round.verified ? "badge-success" : "badge-danger";
        const badgeText = round.verified ? "PASS" : "FAIL";
        
        row.innerHTML = `
            <td>${round.iteration}</td>
            <td class="font-mono" title="C0: ${round.commitments[0]}\nC1: ${round.commitments[1]}">
                C₀: ${c0_trunc}<br>C₁: ${c1_trunc}
            </td>
            <td><span class="badge" style="background-color: var(--primary-glow); color: var(--primary);">${round.challenge}</span></td>
            <td class="font-mono">Val: ${open_val}<br>Salt: ${open_salt}</td>
            <td><span class="badge ${badgeClass}">${badgeText}</span></td>
        `;
        zkpAuditBody.appendChild(row);
    });
}

// ==========================================
// Part 2: Merkle Tree API Requests & UI
// ==========================================

async function fetchMerkleState() {
    try {
        const response = await fetch("/api/merkle/state");
        const data = await response.json();
        
        currentMerkleRoot = data.root;
        currentMerkleLeaves = data.leaves;
        currentDeposits = data.deposited_coins;
        
        updateMerkleUI();
    } catch (error) {
        console.error("Error fetching Merkle state:", error);
    }
}

async function depositCoin() {
    const coin = coinInput.value;
    if (!coin || coin.trim() === "") {
        alert("Please enter a valid unique coin ID/string.");
        return;
    }

    try {
        const response = await fetch("/api/merkle/deposit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ coin: coin })
        });
        const data = await response.json();
        
        if (response.ok) {
            coinInput.value = ""; // Clear input
            currentMerkleRoot = data.root;
            currentMerkleLeaves = data.leaves;
            currentDeposits = data.deposited_coins;
            updateMerkleUI();
        } else {
            alert("Deposit Error: " + data.error);
        }
    } catch (error) {
        console.error("Error depositing coin:", error);
    }
}

async function resetMerkleTree() {
    if (!confirm("Are you sure you want to reset the Merkle Tree?")) {
        return;
    }
    
    try {
        const response = await fetch("/api/merkle/reset", { method: "POST" });
        const data = await response.json();
        
        currentMerkleRoot = data.root;
        currentMerkleLeaves = data.leaves;
        currentDeposits = data.deposited_coins;
        
        // Clear selected elements
        selectedLeafIndex = null;
        currentProof = null;
        currentProofLeaf = null;
        
        // Hide proof display
        proofResult.classList.add("hidden");
        verificationStatus.classList.add("hidden");
        proveBtn.disabled = true;
        
        updateMerkleUI();
    } catch (error) {
        console.error("Error resetting tree:", error);
    }
}

function updateMerkleUI() {
    // 1. Update root
    merkleRootValue.innerText = currentMerkleRoot;
    
    // 2. Update counter
    const activeLeavesCount = currentDeposits.length;
    anonSetSize.innerText = activeLeavesCount;
    
    // 3. Render Leaf grid
    leafGridDisplay.innerHTML = "";
    leafSelect.innerHTML = '<option value="" disabled selected>Select a leaf to prove...</option>';
    
    // Create 16 leaf blocks (our tree capacity)
    for (let i = 0; i < 16; i++) {
        const leafHash = currentMerkleLeaves[i];
        const isPlaceholder = leafHash === "5a396263592c30f4a478be51a8a25c15e85f0cf5637254dfb0e271ee389e81b6"; // EMPTY_HASH in hex
        
        const leafNode = document.createElement("div");
        leafNode.className = "leaf-node";
        leafNode.id = `leaf-node-${i}`;
        
        // If it's an active leaf (has a coin)
        if (!isPlaceholder) {
            leafNode.classList.add("active-leaf");
            
            // Match corresponding coin name
            const coinName = currentDeposits[i] || `Coin ${i}`;
            
            leafNode.innerHTML = `
                <span class="node-idx">Leaf [${i}]</span>
                <span class="node-val" title="${coinName}">${coinName}</span>
                <span class="node-val font-mono" style="font-size: 0.6rem;">${truncateHash(leafHash, 8)}</span>
            `;
            
            // Add click selector
            leafNode.addEventListener("click", () => selectLeafFromGrid(i));
            
            // Add option to select dropdown
            const option = document.createElement("option");
            option.value = i;
            option.text = `Leaf [${i}] - ${coinName}`;
            leafSelect.appendChild(option);
        } else {
            // Empty leaf slot
            leafNode.innerHTML = `
                <span class="node-idx" style="color: var(--text-muted);">Leaf [${i}]</span>
                <span class="node-val" style="color: var(--text-muted); font-style: italic;">Empty Slot</span>
            `;
        }
        leafGridDisplay.appendChild(leafNode);
    }
    
    // Sync selections if reset or updated
    if (selectedLeafIndex !== null) {
        if (selectedLeafIndex < activeLeavesCount) {
            leafSelect.value = selectedLeafIndex;
            highlightLeafNode(selectedLeafIndex);
            proveBtn.disabled = false;
        } else {
            selectedLeafIndex = null;
            proveBtn.disabled = true;
        }
    }
}

function selectLeafFromGrid(idx) {
    selectedLeafIndex = idx;
    leafSelect.value = idx;
    highlightLeafNode(idx);
    proveBtn.disabled = false;
}

function highlightLeafNode(idx) {
    // Remove selected class from all leaf nodes
    document.querySelectorAll(".leaf-node").forEach(node => {
        node.classList.remove("selected-leaf");
    });
    
    // Add selected class to the active node
    const activeNode = document.getElementById(`leaf-node-${idx}`);
    if (activeNode) {
        activeNode.classList.add("selected-leaf");
    }
}

async function generateMerkleProof() {
    if (selectedLeafIndex === null) return;
    
    try {
        const response = await fetch(`/api/merkle/proof?index=${selectedLeafIndex}`);
        const data = await response.json();
        
        if (response.ok) {
            currentProof = data.proof;
            currentProofLeaf = currentDeposits[selectedLeafIndex]; // Save the raw coin string for verification
            
            // Show proof panel
            proofResult.classList.remove("hidden");
            verificationStatus.classList.add("hidden"); // Reset verification alert
            
            // Render path steps
            proofPathDisplay.innerHTML = "";
            data.proof.forEach((step, idx) => {
                const stepEl = document.createElement("div");
                stepEl.className = "proof-step";
                
                const directionText = step.is_left ? "Left Sibling" : "Right Sibling";
                
                stepEl.innerHTML = `
                    <span>Level ${idx + 1}: <span class="hash" title="${step.hash}">${truncateHash(step.hash, 16)}</span></span>
                    <span class="direction"><i class="fa-solid ${step.is_left ? 'fa-arrow-left' : 'fa-arrow-right'}"></i> ${directionText}</span>
                `;
                proofPathDisplay.appendChild(stepEl);
            });
        } else {
            alert("Proof Error: " + data.error);
        }
    } catch (error) {
        console.error("Error generating proof:", error);
    }
}

async function verifyMerkleProof() {
    if (!currentProof || !currentProofLeaf || !currentMerkleRoot) return;
    
    try {
        const response = await fetch("/api/merkle/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                leaf: currentProofLeaf,
                proof: currentProof,
                root: currentMerkleRoot
            })
        });
        const data = await response.json();
        
        // Display verification status
        verificationStatus.classList.remove("hidden");
        if (response.ok && data.valid) {
            verificationStatus.className = "verification-badge success";
            verificationStatus.innerHTML = '<i class="fa-solid fa-circle-check"></i> Verification Successful! Coin verified in anonymity pool.';
        } else {
            verificationStatus.className = "verification-badge fail";
            verificationStatus.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Verification Failed: Sibling hashes mismatch root.';
        }
    } catch (error) {
        console.error("Error verifying proof:", error);
    }
}
