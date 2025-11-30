import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowLeft, Plus, Volume2, Square, BookOpen, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Note {
  id: string;
  title: string;
  content: string;
  subject: string;
  created_at: string;
}

const NotesLibrary = () => {
  const navigate = useNavigate();
  const [notes, setNotes] = useState<Note[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newNote, setNewNote] = useState({ title: "", content: "", subject: "" });
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    checkAuthAndFetchNotes();
  }, []);

  const checkAuthAndFetchNotes = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    // For now, using local storage until we create a notes table
    const storedNotes = localStorage.getItem(`notes_${user.id}`);
    if (storedNotes) {
      setNotes(JSON.parse(storedNotes));
    }
  };

  const saveNotesToStorage = (updatedNotes: Note[]) => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        localStorage.setItem(`notes_${user.id}`, JSON.stringify(updatedNotes));
      }
    });
  };

  const handleCreateNote = () => {
    if (!newNote.title.trim() || !newNote.content.trim()) {
      toast.error("Please fill in title and content");
      return;
    }

    const note: Note = {
      id: Date.now().toString(),
      title: newNote.title,
      content: newNote.content,
      subject: newNote.subject || "General",
      created_at: new Date().toISOString(),
    };

    const updatedNotes = [note, ...notes];
    setNotes(updatedNotes);
    saveNotesToStorage(updatedNotes);
    setNewNote({ title: "", content: "", subject: "" });
    setIsCreating(false);
    toast.success("Note created successfully!");
  };

  const handleDeleteNote = (noteId: string) => {
    const updatedNotes = notes.filter(note => note.id !== noteId);
    setNotes(updatedNotes);
    saveNotesToStorage(updatedNotes);
    if (selectedNote?.id === noteId) {
      setSelectedNote(null);
    }
    toast.success("Note deleted");
  };

  const handleListen = (content: string) => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    if (!window.speechSynthesis) {
      toast.error("Text-to-speech not supported in this browser");
      return;
    }

    const utterance = new SpeechSynthesisUtterance(content);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onend = () => {
      setIsSpeaking(false);
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      toast.error("Failed to read notes");
    };

    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
    toast.success("Started reading notes");
  };

  const handleStopListening = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    toast.info("Stopped reading");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Notes Library
              </h1>
              <p className="text-muted-foreground">Your personal study notes collection</p>
            </div>
          </div>
          <Button onClick={() => setIsCreating(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Note
          </Button>
        </div>

        {isCreating && (
          <Card className="mb-6 border-primary/20">
            <CardHeader>
              <CardTitle>Create New Note</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Note Title"
                value={newNote.title}
                onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
              />
              <Input
                placeholder="Subject (e.g., History, Polity)"
                value={newNote.subject}
                onChange={(e) => setNewNote({ ...newNote, subject: e.target.value })}
              />
              <Textarea
                placeholder="Note content..."
                value={newNote.content}
                onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
                className="min-h-[200px]"
              />
              <div className="flex gap-2">
                <Button onClick={handleCreateNote}>Create Note</Button>
                <Button variant="outline" onClick={() => setIsCreating(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {selectedNote ? (
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle>{selectedNote.title}</CardTitle>
                  <CardDescription className="mt-2">
                    {selectedNote.subject} • {new Date(selectedNote.created_at).toLocaleDateString()}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  {isSpeaking ? (
                    <Button size="sm" variant="destructive" onClick={handleStopListening}>
                      <Square className="mr-2 h-4 w-4" />
                      Stop
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => handleListen(selectedNote.content)}>
                      <Volume2 className="mr-2 h-4 w-4" />
                      Listen
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setSelectedNote(null)}>
                    Back
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none">
                <p className="whitespace-pre-wrap text-foreground">{selectedNote.content}</p>
              </div>
            </CardContent>
          </Card>
        ) : notes.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {notes.map((note) => (
              <Card 
                key={note.id}
                className="cursor-pointer hover:shadow-lg transition-all border-2 hover:border-primary"
                onClick={() => setSelectedNote(note)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg line-clamp-2">{note.title}</CardTitle>
                      <CardDescription className="mt-2">
                        {new Date(note.created_at).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    <BookOpen className="h-5 w-5 text-primary flex-shrink-0" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
                    {note.content}
                  </p>
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary">{note.subject}</Badge>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteNote(note.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No notes yet. Create your first note!</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default NotesLibrary;
