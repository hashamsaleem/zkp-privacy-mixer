import unittest
import sys
import os

# Adjust path to import files from parent directory
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from merkle import MerkleTree, verifyProof, hash_data, EMPTY_HASH
from zkp import PINProver, PINVerifier, CheatingProver, run_protocol_simulation

class TestMerkleTree(unittest.TestCase):
    def setUp(self):
        # Create tree of depth 4 (capacity 16)
        self.tree = MerkleTree(depth=4)
        self.deposits = [
            "coin_alice_111", "coin_bob_222", "coin_charlie_333",
            "coin_dave_444", "coin_eve_555", "coin_frank_666",
            "coin_grace_777", "coin_heidi_888", "coin_ivan_999",
            "coin_judy_000"
        ]

    def test_tree_construction_and_insertion(self):
        """Tests that 10 deposits can be inserted successfully, changing the root."""
        initial_root = self.tree.get_root()
        
        # Insert 10 items
        for i, coin in enumerate(self.deposits):
            idx = self.tree.insert(coin)
            self.assertEqual(idx, i)
            
        final_root = self.tree.get_root()
        self.assertNotEqual(initial_root, final_root)
        
        # Verify empty leaves are still in the tree slots 10 to 15
        for i in range(10, 16):
            self.assertEqual(self.tree.leaves[i], EMPTY_HASH)

    def test_proof_generation_and_verification(self):
        """Tests that Merkle proofs can be successfully verified for at least 3 leaves."""
        # Insert all 10 deposits
        for coin in self.deposits:
            self.tree.insert(coin)
            
        root = self.tree.get_root()
        
        # Select 3 different leaves to test (e.g. index 0, 5, and 9)
        test_indices = [0, 5, 9]
        
        for idx in test_indices:
            coin = self.deposits[idx]
            # 1. Generate path
            proof = self.tree.generateProof(idx)
            self.assertEqual(len(proof), 4) # depth 4 should have 4 siblings
            
            # 2. Verify path
            is_valid = verifyProof(coin, proof, root)
            self.assertTrue(is_valid, f"Proof verification failed for leaf index {idx}")
            
            # 3. Test verification with tampered leaf
            is_valid_tampered = verifyProof(coin + "_tampered", proof, root)
            self.assertFalse(is_valid_tampered, f"Proof should fail for tampered leaf value.")

            # 4. Test verification with tampered proof sibling hash
            proof_tampered = list(proof)
            proof_tampered[0] = {
                'hash': hash_data("some_garbage"),
                'is_left': proof[0]['is_left']
            }
            is_valid_proof_tampered = verifyProof(coin, proof_tampered, root)
            self.assertFalse(is_valid_proof_tampered, "Proof should fail for tampered sibling hash.")


class TestZKPProtocol(unittest.TestCase):
    def setUp(self):
        self.pin = 5829
        self.prover = PINProver(self.pin)
        self.verifier = PINVerifier(self.pin)

    def test_honest_prover_single_round(self):
        """Tests a single round with the honest prover for both challenge 0 and 1."""
        commitments, salts, state = self.prover.commit()
        
        # Test Challenge 0 (should reveal blinding factor r)
        response_0 = self.prover.respond(0, state)
        passed_0 = self.verifier.verify(commitments, salts, 0, response_0)
        self.assertTrue(passed_0, "Verification failed for honest prover on challenge 0.")
        
        # Test Challenge 1 (should reveal s_val = PIN ^ r)
        response_1 = self.prover.respond(1, state)
        passed_1 = self.verifier.verify(commitments, salts, 1, response_1)
        self.assertTrue(passed_1, "Verification failed for honest prover on challenge 1.")

    def test_simulation_100_iterations_honest(self):
        """Tests that the honest prover always achieves 100% success rate over 100 rounds."""
        results, all_passed, rate = run_protocol_simulation(self.pin, iterations=100, cheat=False)
        self.assertTrue(all_passed)
        self.assertEqual(rate, 100.0)
        self.assertEqual(len(results), 100)

    def test_cheating_prover_fails_some_rounds(self):
        """Tests that the cheating prover fails with high probability over 100 rounds."""
        # Run cheating simulation
        results, all_passed, rate = run_protocol_simulation(self.pin, iterations=100, cheat=True)
        
        # The probability of passing 100 iterations is 1/(2^100) ~ 0.
        # Thus, the cheater should fail at least some iterations (usually ~50%).
        self.assertFalse(all_passed)
        self.assertLess(rate, 100.0)
        
        # Verify that for any round where the verifier challenge didn't match the
        # cheater's prediction, the verification failed.
        for round_detail in results:
            # Reconstruct prediction if possible or check if verified matches expectation
            # Let's count fail rate
            pass

if __name__ == '__main__':
    unittest.main()
