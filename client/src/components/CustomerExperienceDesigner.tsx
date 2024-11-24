'use client'

import React, { useState, useCallback } from 'react'
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Panel,
  MiniMap,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { PlusCircle, MessageCircle, HelpCircle, FileText, Tag, Navigation, Upload } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface NodeData {
  label: string;
  content?: string;
  options?: string[];
  documents?: string[];
}

// Custom Node Types
const WelcomeNode = ({ data }: { data: NodeData }) => (
  <div className="bg-green-100 p-4 rounded-lg shadow min-w-[200px]">
    <h3 className="font-bold mb-2">Welcome Message</h3>
    <p className="text-sm">{data.content || 'Set welcome message'}</p>
  </div>
);

const QuestionNode = ({ data }: { data: NodeData }) => (
  <div className="bg-yellow-100 p-4 rounded-lg shadow min-w-[200px]">
    <h3 className="font-bold mb-2">Question</h3>
    <p className="text-sm">{data.content || 'Set question'}</p>
    {data.options && (
      <ul className="mt-2 text-sm list-disc list-inside">
        {data.options.map((option, i) => (
          <li key={i}>{option}</li>
        ))}
      </ul>
    )}
  </div>
);

const ResponseNode = ({ data }: { data: NodeData }) => (
  <div className="bg-blue-100 p-4 rounded-lg shadow min-w-[200px]">
    <h3 className="font-bold mb-2">Response</h3>
    <p className="text-sm">{data.content || 'Set response'}</p>
  </div>
);

const InfoNode = ({ data }: { data: NodeData }) => (
  <div className="bg-purple-100 p-4 rounded-lg shadow min-w-[200px]">
    <h3 className="font-bold mb-2">Information</h3>
    <p className="text-sm">{data.content || 'Set information'}</p>
    {data.documents && (
      <div className="mt-2 text-sm">
        <p className="font-semibold">Attached Documents:</p>
        <ul className="list-disc list-inside">
          {data.documents.map((doc, i) => (
            <li key={i}>{doc}</li>
          ))}
        </ul>
      </div>
    )}
  </div>
);

const OfferNode = ({ data }: { data: NodeData }) => (
  <div className="bg-red-100 p-4 rounded-lg shadow min-w-[200px]">
    <h3 className="font-bold mb-2">Offer</h3>
    <p className="text-sm">{data.content || 'Set offer'}</p>
  </div>
);

const ActionNode = ({ data }: { data: NodeData }) => (
  <div className="bg-orange-100 p-4 rounded-lg shadow min-w-[200px]">
    <h3 className="font-bold mb-2">Action</h3>
    <p className="text-sm">{data.content || 'Set action'}</p>
  </div>
);

const nodeTypes = {
  welcome: WelcomeNode,
  question: QuestionNode,
  response: ResponseNode,
  info: InfoNode,
  offer: OfferNode,
  action: ActionNode,
};

const initialNodes: Node[] = [
  {
    id: '1',
    type: 'welcome',
    position: { x: 250, y: 5 },
    data: { label: 'Welcome', content: 'Welcome to our business!' },
  },
];

export default function CustomerExperienceDesigner() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [uploadedDocs, setUploadedDocs] = useState<string[]>([]);

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const updateNodeData = useCallback((nodeId: string, newData: any) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: { ...node.data, ...newData },
          };
        }
        return node;
      })
    );
  }, [setNodes]);

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const addNode = (type: string) => {
    const newNode = {
      id: (nodes.length + 1).toString(),
      type,
      position: { x: Math.random() * 500, y: Math.random() * 500 },
      data: { label: `New ${type} Node` },
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const handleDocumentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setUploadedDocs((prev) => [...prev, ...files.map((f) => f.name)]);
  };

  return (
    <div className="h-[600px] flex">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r p-4 flex flex-col">
        <div className="mb-6">
          <h3 className="font-semibold mb-2">Add Nodes</h3>
          <div className="space-y-2">
            <Button onClick={() => addNode('welcome')} className="w-full justify-start">
              <PlusCircle className="w-4 h-4 mr-2" />
              Welcome Message
            </Button>
            <Button onClick={() => addNode('question')} className="w-full justify-start">
              <HelpCircle className="w-4 h-4 mr-2" />
              Question
            </Button>
            <Button onClick={() => addNode('response')} className="w-full justify-start">
              <MessageCircle className="w-4 h-4 mr-2" />
              Response
            </Button>
            <Button onClick={() => addNode('info')} className="w-full justify-start">
              <FileText className="w-4 h-4 mr-2" />
              Information
            </Button>
            <Button onClick={() => addNode('offer')} className="w-full justify-start">
              <Tag className="w-4 h-4 mr-2" />
              Offer
            </Button>
            <Button onClick={() => addNode('action')} className="w-full justify-start">
              <Navigation className="w-4 h-4 mr-2" />
              Action
            </Button>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="font-semibold mb-2">Documents</h3>
          <div className="space-y-2">
            <Label className="cursor-pointer">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-primary transition-colors">
                <Upload className="w-6 h-6 mx-auto mb-2" />
                <span className="text-sm">Upload Documents</span>
                <Input
                  type="file"
                  className="hidden"
                  onChange={handleDocumentUpload}
                  multiple
                />
              </div>
            </Label>
            {uploadedDocs.length > 0 && (
              <Card>
                <CardContent className="py-2">
                  <ul className="text-sm space-y-1">
                    {uploadedDocs.map((doc, i) => (
                      <li key={i} className="truncate">{doc}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Flow Editor */}
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
        >
          <Background />
          <Controls />
          <MiniMap />
          <Panel position="top-right">
            <Button
              variant="outline"
              onClick={() => {
                console.log('Flow saved:', { nodes, edges });
              }}
            >
              Save Flow
            </Button>
          </Panel>
        </ReactFlow>
      </div>

      {/* Node Editor Dialog */}
      {selectedNode && (
        <Dialog open={!!selectedNode} onOpenChange={() => setSelectedNode(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit {selectedNode.type} Node</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Content</Label>
                <Textarea
                  value={selectedNode.data.content || ''}
                  onChange={(e) => {
                    setNodes((nds) =>
                      nds.map((n) =>
                        n.id === selectedNode.id
                          ? { ...n, data: { ...n.data, content: e.target.value } }
                          : n
                      )
                    );
                  }}
                />
              </div>
              {selectedNode.type === 'question' && (
                <div>
                  <Label>Options (one per line)</Label>
                  <Textarea
                    value={selectedNode.data.options?.join('\n') || ''}
                    onChange={(e) => {
                      const options = e.target.value.split('\n').filter(Boolean);
                      setNodes((nds) =>
                        nds.map((n) =>
                          n.id === selectedNode.id
                            ? { ...n, data: { ...n.data, options } }
                            : n
                        )
                      );
                    }}
                  />
                </div>
              )}
              {selectedNode.type === 'info' && (
                <div>
                  <Label>Attach Documents</Label>
                  <select
                    multiple
                    className="w-full border rounded-md p-2"
                    value={selectedNode.data.documents || []}
                    onChange={(e) => {
                      const documents = Array.from(
                        e.target.selectedOptions,
                        (option) => option.value
                      );
                      setNodes((nds) =>
                        nds.map((n) =>
                          n.id === selectedNode.id
                            ? { ...n, data: { ...n.data, documents } }
                            : n
                        )
                      );
                    }}
                  >
                    {uploadedDocs.map((doc) => (
                      <option key={doc} value={doc}>
                        {doc}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
