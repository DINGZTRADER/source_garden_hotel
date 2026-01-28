#!/usr/bin/env python3
"""Generate a human-readable summary from the Firebase analysis report."""

import json
from pathlib import Path

def main():
    report_file = Path("firebase_analysis_report.json")
    
    with open(report_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print("=" * 80)
    print("FIREBASE WRITE-PATH ANALYSIS SUMMARY")
    print("=" * 80)
    
    # Summary section
    summary = data.get("summary", {})
    print(f"\n📊 OVERALL STATISTICS:")
    print(f"   Files analyzed: {summary.get('total_files_analyzed', 0)}")
    print(f"   Collections found: {summary.get('total_collections', 0)}")
    print(f"   Total write operations: {summary.get('all_operations_count', 0)}")
    print(f"     - setDoc/set(): {summary.get('total_set_operations', 0)}")
    print(f"     - updateDoc/update(): {summary.get('total_update_operations', 0)}")
    print(f"     - addDoc/add(): {summary.get('total_write_operations', 0)}")
    print(f"     - deleteDoc/delete(): {summary.get('total_delete_operations', 0)}")
    print(f"     - batch(): {summary.get('total_batch_operations', 0)}")
    print(f"     - runTransaction(): {summary.get('total_transaction_operations', 0)}")
    
    # Collections
    print(f"\n🗂️  FIRESTORE COLLECTIONS IN USE:")
    collections = summary.get('collections_list', [])
    if collections:
        for col in collections:
            print(f"   - {col}")
    else:
        print("   ⚠️  No collections found (likely using nested path structure)")
    
    # Collection usage details
    collection_usage = data.get("collection_usage", {})
    if collection_usage:
        print(f"\n📁 COLLECTION USAGE DETAILS:")
        for col_name, info in collection_usage.items():
            print(f"\n   {col_name}:")
            print(f"      References: {info.get('total_references', 0)}")
            print(f"      Files: {', '.join(info.get('files', []))}")
    
    # Categorized operations
    categorized = data.get("categorized_operations", {})
    if categorized:
        print(f"\n🏷️  OPERATIONS BY CATEGORY:")
        for cat_name, cat_data in categorized.items():
            count = cat_data.get('count', 0)
            if count > 0:
                print(f"\n   {cat_name.replace('_', ' ').title()}: {count} operations")
                
                # Show first 3 operations as examples
                ops = cat_data.get('operations', [])[:3]
                for op in ops:
                    print(f"      • Line {op['line']}: {op['code'][:80]}...")
    
    # Most important: Extract actual Firestore paths
    print(f"\n🔍 FIRESTORE DOCUMENT PATHS IN USE:")
    print("   (Extracted from doc() calls in the code)\n")
    
    all_ops = (
        data.get("write_operations", []) + 
        data.get("set_operations", []) + 
        data.get("update_operations", [])
    )
    
    # Extract unique patterns
    paths = set()
    for op in all_ops:
        code = op.get('code', '')
        # Extract patterns like doc(db, 'artifacts', appId, 'public', 'data', 'COLLECTION', ...)
        if 'artifacts' in code and 'public' in code and 'data' in code:
            # Try to extract the collection name
            parts = code.split("'")
            if len(parts) >= 7:  # artifacts + public + data + collection
                data_idx = -1
                for i, part in enumerate(parts):
                    if part == 'data':
                        data_idx = i
                        break
                if data_idx > 0 and data_idx + 2 < len(parts):
                    collection = parts[data_idx + 2]
                    if collection and collection not in ['artifacts', 'public', 'data']:
                        paths.add(f"artifacts/{'{appId}'}/public/data/{collection}")
    
    for path in sorted(paths):
        print(f"   📄 {path}")
    
    # Critical findings
    print(f"\n⚠️  CRITICAL FINDINGS:")
    
    # Check for direct deletes
    delete_count = summary.get('total_delete_operations', 0)
    if delete_count > 0:
        print(f"   ❌ {delete_count} DELETE operations found (review for audit compliance)")
    else:
        print(f"   ✅ No DELETE operations (good for immutability)")
    
    # Check for batch/transaction usage
    batch_count = summary.get('total_batch_operations', 0)
    tx_count = summary.get('total_transaction_operations', 0)
    if batch_count + tx_count == 0:
        print(f"   ⚠️  No batch or transaction operations (may have atomicity risks)")
    else:
        print(f"   ✅ {batch_count + tx_count} batch/transaction operations found")
    
    # Room vs Bar separation
    bar_ops = categorized.get('bar_operations', {}).get('count', 0)
    room_ops = categorized.get('room_operations', {}).get('count', 0)
    
    print(f"\n💡 KEY INSIGHTS:")
    print(f"   • Bar/POS operations: {bar_ops}")
    print(f"   • Room operations: {room_ops}")
    print(f"   • These need separate v2 folio collections")
    
    print(f"\n" + "=" * 80)
    print("Full report available in: firebase_analysis_report.json")
    print("=" * 80)

if __name__ == "__main__":
    main()
