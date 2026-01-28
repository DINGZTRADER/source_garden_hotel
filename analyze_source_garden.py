#!/usr/bin/env python3
"""
Source Garden HMS - Firebase Write Path Analyzer
Scans the codebase to identify all Firebase write operations and generates a comprehensive report.
"""

import os
import re
import json
from pathlib import Path
from collections import defaultdict

class FirebaseWriteAnalyzer:
    def __init__(self, project_root):
        self.project_root = Path(project_root)
        self.files_analyzed = []
        self.findings = {
            "collections": defaultdict(list),
            "write_operations": [],
            "update_operations": [],
            "delete_operations": [],
            "set_operations": [],
            "batch_operations": [],
            "transaction_operations": [],
            "files_analyzed": [],
            "summary": {}
        }
        
        # Patterns to detect Firebase operations
        self.patterns = {
            "collection": re.compile(r'collection\([\'"]([^\'"]+)[\'"]'),
            "doc": re.compile(r'doc\([\'"]([^\'"]+)[\'"]'),
            "add": re.compile(r'\.add\('),
            "set": re.compile(r'\.set\('),
            "update": re.compile(r'\.update\('),
            "delete": re.compile(r'\.delete\('),
            "batch": re.compile(r'batch\(\)'),
            "transaction": re.compile(r'runTransaction'),
            "setDoc": re.compile(r'setDoc\('),
            "updateDoc": re.compile(r'updateDoc\('),
            "deleteDoc": re.compile(r'deleteDoc\('),
            "addDoc": re.compile(r'addDoc\('),
        }
        
    def analyze_file(self, file_path):
        """Analyze a single file for Firebase write operations."""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                lines = content.split('\n')
                
            self.files_analyzed.append(str(file_path.relative_to(self.project_root)))
            
            # Find collections
            collections_found = self.patterns["collection"].findall(content)
            for col in collections_found:
                self.findings["collections"][col].append({
                    "file": str(file_path.relative_to(self.project_root)),
                    "line_count": len([l for l in lines if col in l])
                })
            
            # Find write operations with context
            for i, line in enumerate(lines, 1):
                line_info = {
                    "file": str(file_path.relative_to(self.project_root)),
                    "line": i,
                    "code": line.strip(),
                    "context": []
                }
                
                # Get context (5 lines before and after)
                start = max(0, i - 6)
                end = min(len(lines), i + 5)
                line_info["context"] = [
                    {"line_num": j + 1, "code": lines[j].strip()} 
                    for j in range(start, end) if lines[j].strip()
                ]
                
                # Check for add operations
                if self.patterns["add"].search(line) or self.patterns["addDoc"].search(line):
                    self.findings["write_operations"].append(line_info)
                
                # Check for set operations
                if self.patterns["set"].search(line) or self.patterns["setDoc"].search(line):
                    self.findings["set_operations"].append(line_info)
                
                # Check for update operations
                if self.patterns["update"].search(line) or self.patterns["updateDoc"].search(line):
                    self.findings["update_operations"].append(line_info)
                
                # Check for delete operations
                if self.patterns["delete"].search(line) or self.patterns["deleteDoc"].search(line):
                    self.findings["delete_operations"].append(line_info)
                
                # Check for batch operations
                if self.patterns["batch"].search(line):
                    self.findings["batch_operations"].append(line_info)
                
                # Check for transaction operations
                if self.patterns["transaction"].search(line):
                    self.findings["transaction_operations"].append(line_info)
                    
        except Exception as e:
            print(f"Error analyzing {file_path}: {e}")
    
    def scan_directory(self):
        """Scan the entire project directory for JavaScript/React files."""
        # Target directories
        target_dirs = ["src", "source_garden", "source_garden_hotel", "public"]
        
        for target_dir in target_dirs:
            dir_path = self.project_root / target_dir
            if not dir_path.exists():
                continue
                
            # Find all .js, .jsx, .ts, .tsx files
            for ext in ["*.js", "*.jsx", "*.ts", "*.tsx"]:
                for file_path in dir_path.rglob(ext):
                    self.analyze_file(file_path)
    
    def generate_summary(self):
        """Generate summary statistics."""
        self.findings["summary"] = {
            "total_files_analyzed": len(self.files_analyzed),
            "total_collections": len(self.findings["collections"]),
            "collections_list": list(self.findings["collections"].keys()),
            "total_write_operations": len(self.findings["write_operations"]),
            "total_set_operations": len(self.findings["set_operations"]),
            "total_update_operations": len(self.findings["update_operations"]),
            "total_delete_operations": len(self.findings["delete_operations"]),
            "total_batch_operations": len(self.findings["batch_operations"]),
            "total_transaction_operations": len(self.findings["transaction_operations"]),
            "all_operations_count": (
                len(self.findings["write_operations"]) +
                len(self.findings["set_operations"]) +
                len(self.findings["update_operations"]) +
                len(self.findings["delete_operations"])
            )
        }
        
        # Collection usage summary
        self.findings["collection_usage"] = {}
        for col_name, usages in self.findings["collections"].items():
            files = list(set([u["file"] for u in usages]))
            self.findings["collection_usage"][col_name] = {
                "files": files,
                "total_references": sum([u["line_count"] for u in usages])
            }
    
    def categorize_operations(self):
        """Categorize operations by flow (bar, room, stock, etc.)."""
        categories = {
            "bar_operations": [],
            "room_operations": [],
            "stock_operations": [],
            "expense_operations": [],
            "shift_operations": [],
            "payment_operations": [],
            "other_operations": []
        }
        
        # Keywords for categorization
        keywords = {
            "bar_operations": ["bar", "pos", "order", "cart", "drink", "menu"],
            "room_operations": ["room", "booking", "checkout", "guest", "folio"],
            "stock_operations": ["stock", "inventory", "supply"],
            "expense_operations": ["expense", "petty"],
            "shift_operations": ["shift", "drawer", "workperiod"],
            "payment_operations": ["payment", "receipt", "invoice", "transaction"]
        }
        
        all_ops = (
            self.findings["write_operations"] + 
            self.findings["set_operations"] + 
            self.findings["update_operations"]
        )
        
        for op in all_ops:
            categorized = False
            for cat, kws in keywords.items():
                if any(kw in op["code"].lower() or kw in op["file"].lower() for kw in kws):
                    categories[cat].append(op)
                    categorized = True
                    break
            
            if not categorized:
                categories["other_operations"].append(op)
        
        self.findings["categorized_operations"] = {
            k: {"count": len(v), "operations": v} 
            for k, v in categories.items()
        }
    
    def save_report(self, output_file="firebase_analysis_report.json"):
        """Save the analysis report to a JSON file."""
        self.findings["files_analyzed"] = self.files_analyzed
        
        output_path = self.project_root / output_file
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(self.findings, f, indent=2)
        
        print(f"\n✅ Analysis complete!")
        print(f"📄 Report saved to: {output_path}")
        print(f"\n📊 Summary:")
        print(f"   Files analyzed: {self.findings['summary']['total_files_analyzed']}")
        print(f"   Collections found: {self.findings['summary']['total_collections']}")
        print(f"   Collections: {', '.join(self.findings['summary']['collections_list'])}")
        print(f"   Total operations: {self.findings['summary']['all_operations_count']}")
        print(f"     - Write (add): {self.findings['summary']['total_write_operations']}")
        print(f"     - Set: {self.findings['summary']['total_set_operations']}")
        print(f"     - Update: {self.findings['summary']['total_update_operations']}")
        print(f"     - Delete: {self.findings['summary']['total_delete_operations']}")
        print(f"     - Batch: {self.findings['summary']['total_batch_operations']}")
        print(f"     - Transaction: {self.findings['summary']['total_transaction_operations']}")
        
        return output_path
    
    def run(self):
        """Run the full analysis."""
        print("🔍 Starting Firebase write-path analysis...")
        self.scan_directory()
        self.generate_summary()
        self.categorize_operations()
        return self.save_report()


if __name__ == "__main__":
    # Get project root (current directory)
    project_root = Path(__file__).parent
    
    print(f"📁 Project root: {project_root}")
    
    analyzer = FirebaseWriteAnalyzer(project_root)
    report_path = analyzer.run()
    
    print(f"\n✨ Next steps:")
    print(f"   1. Review the report: {report_path}")
    print(f"   2. Share findings to map v1 → v2 migration paths")
