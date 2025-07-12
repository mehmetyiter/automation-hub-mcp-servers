import React, { useState } from 'react';
import { Button } from './Button';
import { Card, CardHeader, CardBody, CardFooter } from './Card';
import { Modal } from './Modal';
import { Table, type Column } from './Table';
import { MetricCard, SimpleLineChart, SimpleBarChart } from './Charts';
import { useNotifications, createNotificationHelpers } from '../../hooks/useNotifications';
import { NotificationSystem } from '../features/NotificationSystem';
import { CredentialWizard } from '../features/CredentialWizard';
import { 
  Activity, 
  DollarSign, 
  Shield, 
  Users,
  Plus,
  Download,
  Upload,
  Trash2
} from 'lucide-react';

// Sample data for table
const sampleTableData = [
  { id: 1, name: 'John Doe', email: 'john@example.com', role: 'Admin', status: 'Active' },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'User', status: 'Active' },
  { id: 3, name: 'Bob Johnson', email: 'bob@example.com', role: 'User', status: 'Inactive' },
];

const columns: Column[] = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'email', label: 'Email', sortable: true },
  { key: 'role', label: 'Role' },
  { 
    key: 'status', 
    label: 'Status',
    render: (value) => (
      <span className={`px-2 py-1 rounded-full text-xs ${
        value === 'Active' 
          ? 'bg-green-100 text-green-800' 
          : 'bg-gray-100 text-gray-800'
      }`}>
        {value}
      </span>
    )
  },
];

// Sample chart data
const lineChartData = [
  { timestamp: '2024-01-01', value: 100 },
  { timestamp: '2024-01-02', value: 120 },
  { timestamp: '2024-01-03', value: 115 },
  { timestamp: '2024-01-04', value: 130 },
  { timestamp: '2024-01-05', value: 125 },
  { timestamp: '2024-01-06', value: 140 },
  { timestamp: '2024-01-07', value: 135 },
];

const barChartData = [
  { label: 'Jan', value: 65, color: '#3B82F6' },
  { label: 'Feb', value: 75, color: '#10B981' },
  { label: 'Mar', value: 85, color: '#F59E0B' },
  { label: 'Apr', value: 72, color: '#EF4444' },
];

export const UITestPage: React.FC = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [loadingButton, setLoadingButton] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const notifications = useNotifications();
  const notify = createNotificationHelpers(notifications);

  const handleLoadingButton = () => {
    setLoadingButton(true);
    setTimeout(() => setLoadingButton(false), 2000);
  };

  return (
    <div className="p-8 space-y-8 bg-gray-50 min-h-screen">
      {/* Notification System */}
      <NotificationSystem />

      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">UI Component Test Page</h1>
        <p className="mt-2 text-gray-600">Test all UI components and interactions</p>
      </div>

      {/* Buttons Section */}
      <Card>
        <CardHeader title="Buttons" subtitle="Various button styles and states" />
        <CardBody>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Danger</Button>
            </div>
            
            <div className="flex flex-wrap gap-3">
              <Button size="xs">Extra Small</Button>
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">Large</Button>
              <Button size="xl">Extra Large</Button>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button leftIcon={Plus}>Add Item</Button>
              <Button rightIcon={Download}>Download</Button>
              <Button isLoading loadingText="Processing...">Submit</Button>
              <Button disabled>Disabled</Button>
            </div>

            <Button 
              variant="primary"
              onClick={handleLoadingButton}
              isLoading={loadingButton}
              loadingText="Saving..."
              fullWidth
            >
              Click to Test Loading
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Cards Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card variant="default">
          <CardHeader 
            title="Default Card" 
            subtitle="With header and footer"
            actions={<Button size="sm" variant="ghost">Action</Button>}
          />
          <CardBody>
            <p className="text-gray-600">This is a default card with all sections.</p>
          </CardBody>
          <CardFooter>
            <Button variant="outline" size="sm">Cancel</Button>
            <Button variant="primary" size="sm">Save</Button>
          </CardFooter>
        </Card>

        <Card variant="elevated" hover>
          <CardBody>
            <h3 className="font-semibold text-gray-900 mb-2">Elevated Card</h3>
            <p className="text-gray-600">This card has elevation and hover effect.</p>
          </CardBody>
        </Card>
      </div>

      {/* Metrics Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Revenue"
          value="$45,231"
          change={{ value: 12.5, type: 'increase', period: 'last month' }}
          icon={<DollarSign className="w-6 h-6" />}
          color="green"
        />
        <MetricCard
          title="Active Users"
          value="1,234"
          change={{ value: 5.2, type: 'decrease', period: 'last week' }}
          icon={<Users className="w-6 h-6" />}
          color="blue"
        />
        <MetricCard
          title="Security Score"
          value="98%"
          icon={<Shield className="w-6 h-6" />}
          color="purple"
        />
        <MetricCard
          title="API Calls"
          value="45.2K"
          change={{ value: 23, type: 'increase', period: 'today' }}
          icon={<Activity className="w-6 h-6" />}
          color="yellow"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Line Chart" subtitle="Time series data" />
          <CardBody>
            <SimpleLineChart
              data={lineChartData}
              height={200}
              showGrid
              showPoints
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Bar Chart" subtitle="Category comparison" />
          <CardBody>
            <SimpleBarChart
              data={barChartData}
              height={200}
              showValues
            />
          </CardBody>
        </Card>
      </div>

      {/* Table Section */}
      <Card>
        <CardHeader title="Data Table" subtitle="Sortable table with custom rendering" />
        <CardBody>
          <Table
            data={sampleTableData}
            columns={columns}
            hover
            variant="striped"
          />
        </CardBody>
      </Card>

      {/* Modal Section */}
      <Card>
        <CardHeader title="Modals & Dialogs" />
        <CardBody>
          <div className="space-x-3">
            <Button onClick={() => setModalOpen(true)}>
              Open Modal
            </Button>
            <Button variant="secondary" onClick={() => setShowWizard(true)}>
              Open Credential Wizard
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Notifications Section */}
      <Card>
        <CardHeader title="Notifications" subtitle="Click buttons to trigger notifications" />
        <CardBody>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => notify.success('Success!', 'Operation completed successfully')}
            >
              Success Toast
            </Button>
            <Button
              variant="outline"
              onClick={() => notify.error('Error!', 'Something went wrong. Please try again.')}
            >
              Error Toast
            </Button>
            <Button
              variant="outline"
              onClick={() => notify.warning('Warning!', 'This action may have consequences')}
            >
              Warning Toast
            </Button>
            <Button
              variant="outline"
              onClick={() => notify.info('Info', 'Did you know? This is an info message')}
            >
              Info Toast
            </Button>
            <Button
              variant="outline"
              onClick={() => notifications.show({
                type: 'success',
                title: 'Action Required',
                message: 'Do you want to proceed with this action?',
                actions: [
                  { label: 'Cancel', action: () => console.log('Cancelled') },
                  { label: 'Proceed', action: () => console.log('Proceeded'), variant: 'primary' }
                ],
                persistent: true
              })}
            >
              With Actions
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Modal Component */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Example Modal"
        description="This is a fully accessible modal with focus trapping"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setModalOpen(false)}>
              Confirm
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            This modal demonstrates proper accessibility features including:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
            <li>Focus trapping</li>
            <li>Escape key handling</li>
            <li>Click outside to close</li>
            <li>Proper ARIA attributes</li>
            <li>Return focus on close</li>
          </ul>
        </div>
      </Modal>

      {/* Credential Wizard */}
      {showWizard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Credential Setup</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowWizard(false)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <CredentialWizard />
          </div>
        </div>
      )}
    </div>
  );
};